import m from "mithril";
import "./css/style.css";
import { Playground } from "./graph-playground";

document.documentElement.setAttribute("lang", "en");

m.route(document.body, "/", {
  "/": Playground,
});
