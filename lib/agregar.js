var sys = require('sys'),
    fs = require('fs'),
    Buffer = require('buffer').Buffer;


function Collection(filename) {
    var writer, reader; // FDs for reading and writing to the file
    var index = {};
    var writeQueue = [];

    // Open a single writer and reader
    writer = fs.openSync(filename, "a");
    reader = fs.openSync(filename, "r");

    function loadDatabase() {
        sys.debug("Loading...");
        var CHUNK_SIZE = 1024;
        var MAX_SIZE = 1024 * 1024;

        // Create a buffer for reading chunks from the disk
        var chunk = new Buffer(CHUNK_SIZE);

        // Create an empty stream buffer
        var input = new Buffer(MAX_SIZE);
        input.length = 0;

        // These are positions in the database file
        var offset = 0;
        var base = 0;

        // This is a position within the input stream
        var pos = 0;
        var mid = 0;

        // Read a chunk from the file into `chunk`
        while ((chunk.length = fs.readSync(reader, chunk, 0, CHUNK_SIZE, offset)) > 0) {

            // Move the offset so the outer loop stays in sync
            offset += chunk.length;

            // Copy the chunk onto the input stream
            chunk.copy(input, input.length, 0, chunk.length);
            input.length += chunk.length;

            // See if there is input to consume
            for (var i = pos, l = input.length; i < l; i++) {
                if (input[i] === 9) {
                    mid = i + 1;
                }
                if (mid && input[i] === 10) {
                    var meta = JSON.parse(input.slice(pos, mid - 1).toString());
                    var doc = input.slice(mid, i).toString();
                    meta.offset = base + mid;
                    meta.length = i - mid;
                    sys.puts(sys.inspect(meta));
                    sys.puts(doc);
                    mid = 0;
                    pos = i + 1;
                    // TODO: use
                }
            }

            // Shift the input back down
            if (pos > 0) {
                input.copy(input, 0, pos, input.length);
                input.length -= pos;
                base += pos;
                pos = 0;
            }
        }

    }

    loadDatabase();

    var lock = 0;
    function checkQueue() {
        lock++;
        if (lock > 1 || writeQueue === 0) { return; }
        var next = writeQueue.shift();
        var entry = new Buffer(JSON.stringify(next.meta) + "\t" + JSON.stringify(next.doc) + "\n");
        fs.write(writer, entry, null, entry.length, null, function (err, written) {
            if (err) throw err;
            sys.debug(written);
        });

    }

    return {
        createDocument: function (doc, key) {
            if (!key) {
                key = getNextKey();
            }
            writeQueue.push({meta: {key: key}, doc: doc});
            checkQueue();
        }
    };
}

var users = new Collection("../data/users.db");

// var doc = users.createDocument({name: "Tim", age: 28}, 1);