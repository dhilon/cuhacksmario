import { Router, Switch, Route } from "wouter";
import Home from "./Home";
import MarioAI from "./MarioAI";
import MarioGame from "./components/MarioGame";
import { LevelCompletionProvider } from "./context/LevelCompletionContext";
import MarioGame2 from "./components/MarioGame2";
import MarioGame3 from "./components/MarioGame3";
import MarioGame4 from "./components/MarioGame4";
import MarioGame5 from "./components/MarioGame5";
import MarioGame6 from "./components/MarioGame6";
import MarioGame7 from "./components/MarioGame7";
import MarioGame8 from "./components/MarioGame8";
import MarioGame9 from "./components/MarioGame9";
import MarioGame10 from "./components/MarioGame10";
import MarioGame11 from "./components/MarioGame11";
import MarioGame12 from "./components/MarioGame12";
import MarioGame13 from "./components/MarioGame13";
import MarioGame14 from "./components/MarioGame14";
import MarioGame15 from "./components/MarioGame15";
import MarioGame16 from "./components/MarioGame16";
import MarioGame17 from "./components/MarioGame17";

export default function App() {
  return (
    <LevelCompletionProvider>
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
          <Route path="/game10" component={MarioGame10} />
          <Route path="/game11" component={MarioGame11} />
          <Route path="/game12" component={MarioGame12} />
          <Route path="/game13" component={MarioGame13} />
          <Route path="/game14" component={MarioGame14} />
          <Route path="/game15" component={MarioGame15} />
          <Route path="/game16" component={MarioGame16} />
          <Route path="/game17" component={MarioGame17} />
          <Route path="/AI" component={MarioAI} />
        </Switch>
      </Router>
    </LevelCompletionProvider>
  );
}
