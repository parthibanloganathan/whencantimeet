/**
 * Code that gets injected into the when2meet page to select available times.
 *
 * @param {args} the list of events to exclude
 */
function injectedcode(args) {
    var grid = document.getElementById('YouGrid');
    var d = new Date();

    for (var i = 0; i < args.length; i++) {
        args[i].start = Math.floor(parseInt(args[i].start, 10) / 1000) - d.getTimezoneOffset() * 60;
        args[i].end = Math.floor(parseInt(args[i].end, 10) / 1000) - d.getTimezoneOffset() * 60;
    }
    if (grid) {
        var tags = grid.getElementsByTagName('div');
        var times = [];
        var taglookup = {};
        var regex = /YouTime(\d+)/;
        for (var i = 0; i < tags.length; i++) {
            var matched = tags[i].id.match(regex);
            if (matched) {
                tags[i].time = parseInt(matched[1], 10);
                taglookup[tags[i].time] = tags[i];
                times.push(tags[i].time);
            } else {
            }
        }
        times.sort();

        var available = [];
        for (var i = 0; i < times.length; i++) {
            available.push(1);
        }

        var now = new Date().getTime() / 1000;

        for (var i = 0; i < times.length; i++) {
            if (times[i] < now) {
                available[i] = 0;
            } else {
                break;
            }
        }

        args.sort(function(a, b) { return a.start - b.start; });
        var intervals = [];

        var earliest_start = null;
        var latest_end = null;
        var intdata = [];

        for (var i = 0; i < args.length; i++) {
            var start = args[i].start;
            var end = args[i].end;
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
                    timeslots: [],
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
                timeslots: [],
                data: intdata
            });
        }

        var ptr = 0;
        if (intervals.length > 0) {
            for (var i = 0; i < times.length; i++) {
                if (times[i] >= intervals[ptr].s && times[i] < intervals[ptr].e) {
                    available[i] = 0;
                    intervals[ptr].timeslots.push(times[i]);
                }
                else if (times[i] > intervals[ptr].e) {
                    ptr++;
                }
                if (ptr >= intervals.length) {
                    break;
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

        for (var i = 0; i < intervals.length; i++) {
            var interval = intervals[i];

            for (var j = 0; j < interval.timeslots.length; j++) {
                var title = '';
                var ts = interval.timeslots[j];

                for (var k = 0; k < interval.data.length; k++) {
                    var evt = interval.data[k];

                    if (evt.start <= ts && evt.end >= ts) {
                        if (title.length > 0) {
                            title = title + '\n';
                        }
                        title = title + evt.title;
                    }
                }
                taglookup[ts].title = title;
                console.log(ts, title);
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
