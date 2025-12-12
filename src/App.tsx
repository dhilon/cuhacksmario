import { Switch } from "wouter";
import { Router, Route, } from "wouter";
import Home from "./Home";
import MarioAI from "./MarioAI";
import MarioGame from "./components/MarioGame";
import MarioGame2 from "./components/MarioGame2";
import MarioGame3 from "./components/MarioGame3";
import MarioGame4 from "./components/MarioGame4";
import MarioGame5 from "./components/MarioGame5";

export default function App() {
  return (
    <Switch>

      <Router base="/">
        <Route path="/" component={Home}></Route>
        <Route path="/home" component={Home}></Route>
        <Route path="/game" component={MarioGame}></Route>
        <Route path="/game2" component={MarioGame2}></Route>
        <Route path="/game3" component={MarioGame3}></Route>
        <Route path="/game4" component={MarioGame4}></Route>
        <Route path="/game5" component={MarioGame5}></Route>
        <Route path="/AI" component={MarioAI}></Route>

      </Router>

    </Switch>
  )
}

