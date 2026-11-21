// Browser entry for the state-counter example.
//
// Importing the view module runs its auto-mount block: the view is a full
// page with @state, so the emitted module calls mountNmlState with the
// SSR payload state (falling back to the embedded initial state). The page
// is already server-rendered, so mounting only wires the listeners.
import "../views/index.nml";
