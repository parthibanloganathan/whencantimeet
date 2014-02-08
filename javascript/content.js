function injectedcode(args) {
    var grid = document.getElementById('YouGrid');

    for (var i = 0; i < args.length; i++) {
        args[i].start = Math.floor(parseInt(args[i].start, 10) / 1000);
        args[i].end = Math.floor(parseInt(args[i].end, 10) / 1000);
        // args[i].st = new Date(args[i].start * 1000);
        // args[i].et = new Date(args[i].end * 1000);
    }
    if (grid) {
        var tags = grid.getElementsByTagName('div');
        var rectangles = [];
        var times = [];
        var regex = /YouTime(\d+)/;
        for (var i = 0; i < tags.length; i++) {
            var matched = tags[i].id.match(regex);
            if (matched) {
                tags[i].time = parseInt(matched[1], 10);
                rectangles.push(tags[i]);
                times.push(tags[i].time);
            } else {
            }
        }
        times.sort();

        var available = [];
        for (var i = 0; i < times.length; i++) {
            available.push(1);
        }

        var offset = 0;
        var now = new Date().getTime() / 1000;

        for (var i = 0; i < times.length; i++) {
            if (times[i] < now) {
                available[i] = 0;
            } else {
                //offset = i;
                break;
            }
        }

        args.sort(function(a, b) { return a.start - b.start; });
        var intervals = [];

        var earliest_start = null;
        var latest_end = null;
        var d = new Date();
        var intdata = [];

        for (var i = 0; i < args.length; i++) {
            var start = args[i].start - d.getTimezoneOffset() * 60;
            var end = args[i].end - d.getTimezoneOffset() * 60;
            if (earliest_start == null) {
                earliest_start = start;
            }
            if (latest_end == null) {
                latest_end = end;
            }
            if (end > latest_end && start <= latest_end) {
                latest_end = end;
            }
            if (start > latest_end) {
                intervals.push({
                    s: earliest_start,
                    e: latest_end,
                    st: new Date(earliest_start * 1000 + d.getTimezoneOffset() * 60000),
                    et: new Date(latest_end * 1000 + d.getTimezoneOffset() * 60000),
                    data: intdata
                });
                earliest_start = start;
                latest_end = end;
                intdata = [];
            }
            intdata.push(args[i]);
        }
        if (earliest_start != null && latest_end != null) {
            intervals.push({
                s: earliest_start,
                e: latest_end,
                st: new Date(earliest_start * 1000 + d.getTimezoneOffset() * 60000),
                et: new Date(latest_end * 1000 + d.getTimezoneOffset() * 60000),
                data: intdata
            });
        }

        var ptr = 0;
        if (intervals.length > 0) {
            for (var i = 0; i < times.length; i++) {
                if (ptr >= intervals.length) {
                    break;
                }
                if (times[i] > intervals[ptr].e) {
                    ptr++;
                }
                if (ptr >= intervals.length) {
                    break;
                }
                if (times[i] >= intervals[ptr].s && times[i] < intervals[ptr].e) {
                    available[i] = 0;
                }
            }
        }

        for (var i = 0; i < times.length; i++) {
            if (available[i]) {
                var s = i;

                SelectFromHere(times[i]);
                var day = Math.floor(times[i] / 86400);
                do  {
                    i++; 
                } while (i < times.length 
                        && Math.floor(times[i]/86400) == day 
                        && available[i]);
                i--;
                SelectToHere(times[i]);
                SelectStop();
            }
        }
    }
}

function run(func, args) {
    return '(' + func.toString() + ')(' + args + ')';
}

chrome.runtime.onConnect.addListener(function(port) {
    if (port.name == 'when2meet') {
        port.onMessage.addListener(function(msg) {
            console.log('got message');
            data = msg.data;
            args = JSON.stringify(data);
            var script = document.createElement('script');
            script.appendChild(document.createTextNode(run(injectedcode, args)));
            (document.body || document.head || document.documentElement).appendChild(script);
        });
    }
});
