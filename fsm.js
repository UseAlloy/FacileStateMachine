// TODO: Consider adding a debug mode or extending the event emitter class
// TODO: Consider adding a priorEvent accessor
'use strict';

module.exports = class FSM {
  constructor(options) {
    this.currentState = undefined;
    this.initialState = options.initialState;
    this.meta = Object.keys(options.states).reduce((meta, stateName) => {
      meta[stateName] = {
        concurrency: undefined,
        defer: false,
        queue: [],
      };
      return meta;
    }, {});
    this.priorState = undefined;
    this.states = options.states;
    this.transitionChain = Promise.resolve();
    // Bind unexpected properties to this class so
    // that they may be used internally or externally
    Object.keys(options).forEach((propertyName) => {
      if (propertyName !== 'initialState' && propertyName !== 'states') {
        this[propertyName] = options[propertyName];
      }
    });
    this._initalize();
  }

  // Adds the initial state to the transition chain and executes the onEnter if it exists
  _initalize() {
    if (!this.states[this.initialState]) {
      throw new Error('Initial state is undefined!');
    }
    this.transitionChain = this.transitionChain.then(() => {
      this.currentState = this.initialState;
      // If the initial state has an onEnter function execute it
      if (this.states[this.currentState]._onEnter) {
        this.states[this.currentState]._onEnter.call(this);
      }
    });
  }

  _drainQueue() {
    const concurrency = this.meta[this.currentState].concurrency || this.meta[this.currentState].queue.length;

    let eventQueue = this.meta[this.currentState].queue;
    let currentCycleEvents = eventQueue.slice(0, concurrency);

    if (currentCycleEvents.length > 0) {
      this.meta[this.currentState].queue = eventQueue.slice(concurrency);
      currentCycleEvents.forEach((queued) => {
        this.states[this.currentState][queued.event].apply(
          this,
          queued.args
        );
      });
    }
  }

  transition(targetState) {
    if (!this.states[targetState]) {
      throw new Error('Target state is undefined!');
    }

    let transitionResult;

    // Chain the transitions such that the next transition
    // can't happen until the current one has resolved
    this.transitionChain = this.transitionChain.then(() => {
      // Call current state's onExit if it exists
      if (this.currentState && this.states[this.currentState]._onExit) {
        this.states[this.currentState]._onExit.call(this);
      }

      this.priorState = this.currentState;
      this.currentState = targetState;
      // Reset the event queue deferral if present before calling target's onEnter
      this.meta[this.currentState].defer = false;
      // Reset the event queue concurrency
      this.meta[this.currentState].concurrency = undefined;

      // Call the target state's onEnter if it exsits
      // Will pass additional arguments to this.transition
      // through to the target state's _onEnter function
      if (this.states[targetState]._onEnter) {
        transitionResult = this.states[targetState]._onEnter.apply(
          this,
          Array.prototype.slice.call(arguments, 1)
        );
      }

      this._drainQueue();

      return transitionResult;
    });
  }

  handle() {
    let targetEvent;
    let targetEventArgs = [];
    let targetState = this.currentState;

    switch (arguments.length) {
      case 0: { throw new Error('Handle function requires at least one argument!'); }
      case 1: {
        targetEvent = arguments[0];
        break;
      }

      case 2: {
        // TODO: Broken for this.handle('event in same state', argument1)...
        targetState = arguments[0];
        targetEvent = arguments[1];
        break;
      }

      default: {
        targetState = arguments[0];
        targetEvent = arguments[1];
        targetEventArgs = Array.prototype.slice.call(arguments, 2);
      }
    }

    if (targetState === this.currentState) {
      if (this.meta[this.currentState].defer) {
        // Push event into the current state's queue
        this.meta[targetState].queue.push({
          args: targetEventArgs,
          event: targetEvent,
        });
      } else {
        // Execute event immediately without queueing
        this.states[this.currentState][targetEvent].apply(
          this,
          targetEventArgs
        );
      }
    } else {
      // Push event into the target state's event queue
      this.meta[targetState].queue.push({
        args: targetEventArgs,
        event: targetEvent,
      });
    }
  }

  // Future events will not be executed until we re-enter the current state
  deferEvents() {
    this.meta[this.currentState].defer = true;
  }

  // Override's _drainQueue's concurrency value
  // TODO: Make this work without draining as well ex: within the same state without transitioning
  setQueueDepth(depth) {
    this.meta[this.currentState].concurrency = depth;
  }

  // Syntactic sugar
  transitionAndHandle(targetState, targetEvent) {
    this.transition(targetState);
    if (arguments.length === 2) {
      this.handle(targetState, targetEvent);
    } else {
      this.handle.apply(this, arguments);
    }
  }
};
