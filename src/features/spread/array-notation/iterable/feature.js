expose(
    'symbol/iterator',
    {
        core: parent.solution,
        pass: function(fn) {
            var data = [1, 2, 3];
            var iterable = this.createIterableObject(data);
            var result = fn(iterable);
            return this.sameValues(result, data);
        },
        solution: parent.solution
    }
);
