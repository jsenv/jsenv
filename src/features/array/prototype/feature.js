import {at, present} from '/test-helpers.js';

const test = {
    run: at('Array', 'prototype'),
    complete: present
};

export default test;
