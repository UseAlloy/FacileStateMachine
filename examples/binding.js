'use strict';

const FSM = require('../index');

const bindingTest = new FSM({
  initialState: 'a',
  states: {
    a: {
      _onEnter: function() {
        console.log('Entering A...');
      },
    },
  },
  testExternalFunctionCall: function(args) {
    console.log('External function call success!');
    return args;
  },
});

console.log('Setting up demo timer...');
setTimeout(() => {
  let testReturn = bindingTest.testExternalFunctionCall(true);
  console.log('Result of external return: ', testReturn);
}, 1001);
