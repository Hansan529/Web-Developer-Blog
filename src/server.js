import express from "express";
import morgan from "morgan";
import session from "express-session";
import MongoStore from "connect-mongo";

import rootRouter from "./routers/rootRouter";

const app = express();
const logger = morgan("dev");

app.set("view engine", "pug");
app.set("views", process.cwd() + "/src/views");
app.use(logger);
app.use(
  session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 600000,
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use("/", rootRouter);

export default app;
