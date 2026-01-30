import { Router, Switch, Route } from "wouter";
import Home from "./Home";
import MarioAI from "./MarioAI";
import MarioGame from "./components/MarioGame";
import MarioGame2 from "./components/MarioGame2";
import MarioGame3 from "./components/MarioGame3";
import MarioGame4 from "./components/MarioGame4";
import MarioGame5 from "./components/MarioGame5";
import MarioGame6 from "./components/MarioGame6";
import MarioGame7 from "./components/MarioGame7";
import MarioGame8 from "./components/MarioGame8";
import MarioGame9 from "./components/MarioGame9";

export default function App() {
  return (
    <Router base="/">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/home" component={Home} />
        <Route path="/game" component={MarioGame} />
        <Route path="/game2" component={MarioGame2} />
        <Route path="/game3" component={MarioGame3} />
        <Route path="/game4" component={MarioGame4} />
        <Route path="/game5" component={MarioGame5} />
        <Route path="/game6" component={MarioGame6} />
        <Route path="/game7" component={MarioGame7} />
        <Route path="/game8" component={MarioGame8} />
        <Route path="/game9" component={MarioGame9} />
        <Route path="/AI" component={MarioAI} />
      </Switch>
    </Router>
  );
}
