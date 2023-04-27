import User from "../models/User";
import Project from "../models/Project";
import bcrypt from "bcrypt";
import {
  ADMIN,
  GH_CLIENT,
  GH_SECRET,
  KAKAO_REDIRECT_URI,
  KAKAO_REST_API_KEY,
} from "../data";
import { nanoid } from "nanoid";

export const home = async (req, res) => {
  const projects = await Project.find({}).sort({ date: "desc" });
  return res.render("home", { pageTitle: "메인 홈페이지", projects });
};

export const getJoin = (req, res) => res.render("join");

export const postJoin = async (req, res) => {
  const {
    body: { id, password, email, username },
  } = req;
  try {
    await User.create({
      id,
      password,
      email,
      username,
    });
  } catch (err) {
    return res.send(err);
  }
  return res.redirect("/");
};

export const getLogin = (req, res) => {
  return res.render("login", { pageTitle: "로그인" });
};

export const postLogin = async (req, res) => {
  const {
    body: { id, password, keepLogin },
  } = req;
  const user = await User.findOne({ id });
  const pwdCheck = user && (await bcrypt.compare(password, user.password));
  if (!pwdCheck) {
    return res.send("에러");
  }
  req.session.loggedIn = true;
  req.session.user = user;
  return res.redirect("/");
};

export const getGithubLogin = (req, res) => {
  const baseUrl = "https://github.com/login/oauth/authorize";
  const config = {
    client_id: GH_CLIENT,
    scope: "read:user user:email",
  };
  const params = new URLSearchParams(config).toString();
  const connectUrl = `${baseUrl}?${params}`;
  return res.redirect(connectUrl);
};

export const postGithubLogin = async (req, res) => {
  const baseUrl = "https://github.com/login/oauth/access_token";
  const config = {
    client_id: GH_CLIENT,
    client_secret: GH_SECRET,
    code: req.query.code,
  };

  const params = new URLSearchParams(config).toString();
  const connectUrl = `${baseUrl}?${params}`;

  const tokenRequest = await (
    await fetch(connectUrl, {
      method: "POST",
      headers: { Accept: "application/json" },
    })
  ).json();

  if ("access_token" in tokenRequest) {
    const { access_token } = tokenRequest;
    const apiUrl = "https://api.github.com";

    const userData = await (
      await fetch(`${apiUrl}/user`, {
        headers: { Authorization: `token ${access_token}` },
      })
    ).json();

    const emailData = await (
      await fetch(`${apiUrl}/user/emails`, {
        headers: { Authorization: `token ${access_token}` },
      })
    ).json();

    /** 이메일 배열에서 primary와 verified가 모두 true 인 배열만 찾기 */
    const emailObj = emailData.find(
      (email) => email.primary === true && email.verified === true
    );

    /** 만약 email이 없다면, 오류 메시지와 함께 로그인으로 이동시킴 */
    if (!emailObj) {
      return res.redirect("/login");
    }

    /* 유저 데이터베이스에 email이 primary,verified가 true인 배열과 일치하는 배열만 찾기 */
    const userAlready = await User.findOne({ email: emailObj.email });

    /* 관리자 목록 불러오기 및 배열에서 추출하기 */
    const adminList = ADMIN;

    /* 일치하는 이메일이 있다면, login 성공 */
    if (userAlready) {
      /* 로그인 시도를 하는 유저 중 관리자들 이라면 권한 부여, */
      if (adminList && Array.isArray(adminList)) {
        adminList.split(",");
        adminList.forEach((admin) => {
          if (userAlready.id === admin) {
            req.session.admin = true;
          }
        });
      } else if (
        adminList &&
        !Array.isArray(adminList) &&
        userAlready.id === adminList
      ) {
        /* 관리자가 한명이라면 반복문을 사용하지 않음 */
        req.session.admin = true;
      }
      req.session.loggedIn = true;
      req.session.user = userAlready;
      return res.redirect("/");
    } else {
      const userNameExists = await User.exists({ id: userData.login });
      const nameExists = await User.exists({ username: userData.name });

      let id = userData.login;
      let username = userData.name;

      /* 일치하는 아이디가 있으면 랜덤 아이디로 지정 */
      userNameExists ? (id = nanoid(10)) : id;

      /* 일치하는 닉네임이 있으면 랜덤 닉네임으로 지정 */
      nameExists ? (username = nanoid(10)) : username;

      /* 유저 생성 */
      const user = await User.create({
        socialLogin: true,
        id,
        email: emailObj.email,
        username,
      });

      /* login 처리 */
      req.session.loggedIn = true;
      req.session.user = user;
      return res.redirect("/");
    }
  } else {
    /* access_token이 없을 경우 */
    return res.redirect("/login");
  }
};

export const getKakaoLogin = (req, res) => {
  const baseUrl = `https://kauth.kakao.com/oauth/authorize`;
  const config = {
    response_type: "code",
    client_id: KAKAO_REST_API_KEY,
  };
  const params = new URLSearchParams(config).toString();
  const link = `${baseUrl}?${params}&redirect_uri=${KAKAO_REDIRECT_URI}`;
  return res.redirect(link);
};

export const postKakaoLogin = async (req, res) => {
  const baseUrl = `https://kauth.kakao.com/oauth/token`;
  const config = {
    grant_type: "authorization_code",
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: KAKAO_REDIRECT_URI,
    code: req.query.code,
  };
  const params = new URLSearchParams(config).toString();
  const link = `${baseUrl}?${params}`;
  const response = await fetch(link, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });
  const data = await response.json();

  if ("access_token" in data) {
    /* 엑세스 토큰 저장 */
    const { access_token } = data;

    const apiUrl = "https://kapi.kakao.com/v2/user/me";
    const userSave = await (
      await fetch(apiUrl, {
        headers: {
          "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
          Authorization: `Bearer ${access_token}`,
        },
      })
    ).json();

    /* 해당 이메일을 갖는 유저가 이미 있는지 체크 */
    const userAlready = await User.findOne({
      email: userSave.kakao_account.email,
    });

    /* 이메일이 있다면 로그인 */
    if (userAlready) {
      req.session.loggedIn = true;
      req.session.user = userAlready;
      return res.redirect("/");
    } else {
      /* 없다면 아이디, 별명 체크 후 생성 */
      const idExists = await User.exists({ id: userSave.id });
      const usernameExists = await User.exists({
        username: userSave.properties.nickname,
      });

      /* 아이디 설정 */
      let id = userSave.id;
      /* 별명 이름 설정 */
      let username = userSave.properties.nickname;

      /* 아이디가 중복일 경우 랜덤 아이디 20글자 */
      idExists ? (id = nanoid(20)) : id;

      /* 별명이 중복일 경우 랜덤 별명 10글자 */
      usernameExists ? (username = nanoid(10)) : username;

      /* 계정 생성 */
      const user = await User.create({
        socialLogin: true,
        profileImage: userSave.properties.thumbnail_image,
        id,
        email: userSave.kakao_account.email,
        username,
      });

      req.session.loggedIn = true;
      req.session.user = user;
      return res.redirect("/");
    }
  }
  return res.redirect("/login");
};

export const logout = (req, res) => {
  req.session.destroy();
  return res.redirect("/");
};
