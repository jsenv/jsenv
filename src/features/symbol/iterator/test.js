import {expect, presence} from '/test-helpers.js';

const test = expect({
    'presence': presence('Symbol', 'iterator')
});

export default test;

