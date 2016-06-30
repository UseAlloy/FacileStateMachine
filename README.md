# Facile State Machine

#### Inspiration
A project I started required a means of taming a complex async workflow which was dynamically generated during each runtime.  What better solution than to use a finite state machine I thought?  At the time there were only a handful of libraries for Javascript and even fewer that were actively maintained or well documented.

The most widely adopted solution by far on npm was (ifandelse)[https://www.npmjs.com/~ifandelse]'s [Machina](https://www.npmjs.com/package/machina).  I fought for far too long trying to shoe-horn it into my project but quickly realized I was swimming upstream.

I had a unique atypical requirement which was to have the ability to "defer" state handler events into a queue if needed.  Such that only an X number of events would be executed after transitioning into a target state after which any additional events would line up in a queue where the next transition into the target state would once again process X number from the queue.

I couldn't easily see how to fork Machina's codebase to meet this somewhat bizarre requirement and I increasingly felt that Machina's codebase was far more complicated than it needed to be.

So I decided to try my hand at rolling my own solution and thus the "Facile State Machine" was born.


##### Suspected Possible Issues
  1. Due to the use of promises to manage event chains I worry about memory consumption for long lived state machines with many thousands of transitions.  Unconfirmed problem but worth investigation.
  2. Because none of the state functions have callbacks execution order can't be guaranteed


##### Todo
  1. Unit tests
  2. Example use cases
  3. Documentation


#### API:
  this.transition()
  this.handle()
  this.deferEvents()
  this.setQueueDepth()
