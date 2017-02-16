expose(
    'object/create',
    {
        code: parent.code,
        pass: function(fn) {
            var method = Math.max;
            var data = [1, 2, 3];
            var iterable = this.createIterableObject(data);
            var instance = Object.create(iterable);
            var result = fn(instance);
            return result === method.apply(null, data);
        },
        solution: parent.solution
    }
);
