/**
 *
 * Based on code by The Chromium Authors.
 */

/**
 */

// Redraw interval is 1 min.
var DRAW_INTERVAL = 60 * 1000;

//Object for CanvasAnimation
var canvasAnimation_;

// Storing events.
var eventList = [];

// Storing calendars.
var calendars = [];

var pollUnderProgress = false;
var defaultAuthor = '';
var isMultiCalendar = true;

//URL for getting feed of individual calendar support.
var SINGLE_CALENDAR_SUPPORT_URL = 'https://www.google.com/calendar/feeds' +
    '/default/private/embed?toolbar=true&max-results=10';

//URL for getting feed of multiple calendar support.
var MULTIPLE_CALENDAR_SUPPORT_URL = 'https://www.google.com/calendar/feeds' +
    '/default/allcalendars/full';

//URL for opening Google Calendar in new tab.
var GOOGLE_CALENDAR_URL = 'http://www.google.com/calendar/render';

//URL for declining invitation of the event.
var DECLINED_URL = 'http://schemas.google.com/g/2005#event.declined';

/**
 * Animates the canvas after loading the data from all the calendars. It
 * rotates the icon and defines the badge text and title.
 * @constructor
 */
function CanvasAnimation() {
  this.animationFrames_ = 36;  // The number of animation frames
  this.animationSpeed_ = 10;  // Time between each frame(in ms).
  this.canvas_ = $('canvas');  // The canvas width + height.
  this.canvasContext_ = this.canvas_.getContext('2d');  // Canvas context.
  this.loggedInImage_ = $('logged_in');
  this.rotation_ = 0;  //Keeps count of rotation angle of extension icon.
  this.w = this.canvas_.width;  // Setting canvas width.
  this.h = this.canvas_.height;  // Setting canvas height.
  this.RED = [208, 0, 24, 255];  //Badge color of extension icon in RGB format.
  this.BLUE = [0, 24, 208, 255];
  this.currentBadge_ = null;  // The text in the current badge.
};

/**
 * Flips the icon around and draws it.
 */
CanvasAnimation.prototype.animate = function() {
  this.rotation_ += (1 / this.animationFrames_);
  this.drawIconAtRotation();
  var self = this;
  if (this.rotation_ <= 1) {
    setTimeout(function() {
      self.animate();
    }, self.animationSpeed_);
  } else {
    this.drawFinal();
  }
};

/**
 * Renders the icon.
 */
CanvasAnimation.prototype.drawIconAtRotation = function() {
  this.canvasContext_.save();
  this.canvasContext_.clearRect(0, 0, this.w, this.h);
  this.canvasContext_.translate(Math.ceil(this.w / 2), Math.ceil(this.h / 2));
  this.canvasContext_.rotate(2 * Math.PI * this.getSector(this.rotation_));
  this.canvasContext_.drawImage(this.loggedInImage_, -Math.ceil(this.w / 2),
    -Math.ceil(this.h / 2));
  this.canvasContext_.restore();
  chrome.browserAction.setIcon(
      {imageData: this.canvasContext_.getImageData(0, 0, this.w, this.h)});
};

/**
 * Calculates the sector which has to be traversed in a single call of animate
 * function(360/animationFrames_ = 360/36 = 10 radians).
 * @param {integer} sector angle to be rotated(in radians).
 * @return {integer} value in radian of the sector which it has to cover.
 */
CanvasAnimation.prototype.getSector = function(sector) {
  return (1 - Math.sin(Math.PI / 2 + sector * Math.PI)) / 2;
};

/**
 * Draws the event icon and determines the badge title and icon title.
 */
CanvasAnimation.prototype.drawFinal = function() {
    this.drawIconAtRotation();
    this.rotation_ = 0;
    pollUnderProgress = false;

    chrome.extension.sendRequest({
    message: 'enableSave'
    }, function() {
    });

    return;
};

/**
 * Shows the user logged out.
 */
CanvasAnimation.prototype.showLoggedOut = function() {
  currentBadge_ = '?';
  chrome.browserAction.setIcon({path: '../images/icon-16_bw.gif'});
  chrome.browserAction.setBadgeBackgroundColor({color: [190, 190, 190, 230]});
};

/**
 * Provides all the calendar related utils.
 */
CalendarManager = {};

/**
 * Extracts event from the each entry of the calendar.
 * @param {Object} elem The XML node to extract the event from.
 * @param {Object} mailId email of the owner of calendar in multiple calendar
 *     support.
 * @return {Object} out An object containing the event properties.
 */
CalendarManager.extractEvent = function(elem, mailId) {
  var out = {};

  for (var node = elem.firstChild; node != null; node = node.nextSibling) {
    if (node.nodeName == 'title') {
        out.title = node.firstChild ? node.firstChild.nodeValue : MSG_NO_TITLE;
    } else if (node.nodeName == 'link' &&
               node.getAttribute('rel') == 'alternate') {
      out.url = node.getAttribute('href');
    } else if (node.nodeName == 'gd:where') {
      out.location = node.getAttribute('valueString');
    } else if (node.nodeName == 'gd:who') {
      if (node.firstChild) {
        if ((!isMultiCalendar) || (isMultiCalendar && mailId &&
            node.getAttribute('email') == mailId)) {
          out.attendeeStatus = node.firstChild.getAttribute('value');
        }
      }
    } else if (node.nodeName == 'gd:eventStatus') {
      out.status = node.getAttribute('value');
    } else if (node.nodeName == 'gd:when') {
      var startTimeStr = node.getAttribute('startTime');
      var endTimeStr = node.getAttribute('endTime');

      startTime = rfc3339StringToDate(startTimeStr);
      endTime = rfc3339StringToDate(endTimeStr);

      if (startTime == null || endTime == null) {
        continue;
      }

      out.isAllDay = (startTimeStr.length <= 11);
      out.startTime = startTime;
      out.endTime = endTime;
    }
  }
  return out;
};

/**
 * Polls the server to get the feed of the user.
 * @param {cb} Polls the server and calls cb with the events retrieved.
 */
CalendarManager.pollServer = function(cb) {
  if (!pollUnderProgress) {
    eventList = [];
    pollUnderProgress = true;
    calendars = [];
    var url;
    var xhr = new XMLHttpRequest();
    try {
      xhr.onreadystatechange = CalendarManager.genResponseChangeFunc(xhr, cb);
      xhr.onerror = function(error) {
        console.log('error: ' + error);
        canvasAnimation_.drawFinal();
      };
      if (isMultiCalendar) {
        url = MULTIPLE_CALENDAR_SUPPORT_URL;
      } else {
        url = SINGLE_CALENDAR_SUPPORT_URL;
      }

      xhr.open('GET', url);
      xhr.send(null);
    } catch (e) {
      console.log('ex: ' + e);
      canvasAnimation_.drawFinal();
    }
  }
};

/**
 * Gathers the list of all calendars of a specific user for multiple calendar
 * support and event entries in single calendar.
 * @param {xmlHttpRequest} xhr xmlHttpRequest object containing server response.
 * @param {cb} callback to call when all data has been retrieved.
 * @return {Object} anonymous function which returns to onReadyStateChange.
 */
CalendarManager.genResponseChangeFunc = function(xhr, cb) {
  return function() {
    if (xhr.readyState != 4) {
      return;
    }
    if (!xhr.responseXML) {
      console.log('No responseXML');
      canvasAnimation_.drawFinal();
      return;
    }
    if (isMultiCalendar) {
      var entry_ = xhr.responseXML.getElementsByTagName('entry');
      if (entry_ && entry_.length > 0) {
        calendars = [];
        for (var i = 0, entry; entry = entry_[i]; ++i) {
          if (!i) {
            defaultAuthor = entry.querySelector('title').textContent;
          }
          // Include only those calendars which are not hidden and selected
          var isHidden = entry.querySelector('hidden');
          var isSelected = entry.querySelector('selected');
          if (isHidden && isHidden.getAttribute('value') == 'false') {
            if (isSelected && isSelected.getAttribute('value') == 'true') {
              var calendar_content = entry.querySelector('content');
              var cal_src = calendar_content.getAttribute('src');
              cal_src += '?toolbar=true&max-results=100';
              calendars.push(cal_src);
            }
          }
        }
        CalendarManager.getCalendarFeed(0, cb);
        return;
      }
    } else {
      calendars = [];
      calendars.push(SINGLE_CALENDAR_SUPPORT_URL);
      CalendarManager.parseCalendarEntry(xhr.responseXML, 0, cb);
      return;
    }

    console.error('Error: feed retrieved, but no event found');
    canvasAnimation_.drawFinal();
  };
};

/**
 * Retrieves feed for a calendar
 * @param {integer} calendarId Id of the calendar in array of calendars.
 * @param {cb} callback to call when feed has completed.
 */
CalendarManager.getCalendarFeed = function(calendarId, cb) {
  var xmlhttp = new XMLHttpRequest();
  try {
    xmlhttp.onreadystatechange = CalendarManager.onCalendarResponse(xmlhttp,
                                     calendarId, cb);
    xmlhttp.onerror = function(error) {
      console.log('error: ' + error);
      canvasAnimation_.drawFinal();
    };

    xmlhttp.open('GET', calendars[calendarId]);
    xmlhttp.send(null);
  }
  catch (e) {
    console.log('ex: ' + e);
    canvasAnimation_.drawFinal();
  }
};

/**
 * Gets the event entries of every calendar subscribed in default user calendar.
 * @param {xmlHttpRequest} xmlhttp xmlHttpRequest containing server response
 *     for the feed of a specific calendar.
 * @param {integer} calendarId Variable for storing the no of calendars
 *     processed.
 * @param {cb} The callback function to call with the requested events
 * @return {Object} anonymous function which returns to onReadyStateChange.
 */
CalendarManager.onCalendarResponse = function(xmlhttp, calendarId, cb) {
  return function() {
    if (xmlhttp.readyState != 4) {
      return;
    }
    if (!xmlhttp.responseXML) {
      console.log('No responseXML');
      canvasAnimation_.drawFinal();
      return;
    }
    CalendarManager.parseCalendarEntry(xmlhttp.responseXML, calendarId, cb);
  };
};

/**
 * Parses events from calendar response XML
 * @param {string} responseXML Response XML for calendar.
 * @param {integer} calendarId  Id of the calendar in array of calendars.
 * @param {cb} callback to call with parsed calendar entries.
 */
CalendarManager.parseCalendarEntry = function(responseXML, calendarId, cb) {
  var entry_ = responseXML.getElementsByTagName('entry');
  var mailId = null;
  var author = null;

  if (responseXML.querySelector('author name')) {
    author = responseXML.querySelector('author name').textContent;
  }
  if (responseXML.querySelector('author email')) {
    mailId = responseXML.querySelector('author email').textContent;
  }

  if (entry_ && entry_.length > 0) {
    for (var i = 0, entry; entry = entry_[i]; ++i) {
     var event_ = CalendarManager.extractEvent(entry, mailId);

      // Get the time from then to now
      if (event_.startTime) {
        var t = event_.startTime.getTime() - getCurrentTime();
        if (t >= 0 && (event_.attendeeStatus != DECLINED_URL)) {
            if (isMultiCalendar && author) {
              event_.author = author;
            }
            eventList.push(event_);
        }
      }
    }
  }

  calendarId++;
  //get the next calendar
  if (calendarId < calendars.length) {
    CalendarManager.getCalendarFeed(calendarId, cb);
  } else {
    if (cb !== undefined) {
      cb(eventList);
    }
    canvasAnimation_.drawFinal();
  }
};

var DATE_TIME_REGEX =
  /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+(\+|-)(\d\d):(\d\d)$/;
var DATE_TIME_REGEX_Z = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+Z$/;
var DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;

/**
* Convert the incoming date into a javascript date.
* @param {String} rfc3339 The rfc date in string format as following
*     2006-04-28T09:00:00.000-07:00
*     2006-04-28T09:00:00.000Z
*     2006-04-19.
* @return {Date} The javascript date format of the incoming date.
*/
function rfc3339StringToDate(rfc3339) {
  var parts = DATE_TIME_REGEX.exec(rfc3339);

  // Try out the Z version
  if (!parts) {
    parts = DATE_TIME_REGEX_Z.exec(rfc3339);
  }

  if (parts && parts.length > 0) {
    var d = new Date();
    d.setUTCFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
    d.setUTCHours(parts[4]);
    d.setUTCMinutes(parts[5]);
    d.setUTCSeconds(parts[6]);

    var tzOffsetFeedMin = 0;
    if (parts.length > 7) {
      tzOffsetFeedMin = parseInt(parts[8], 10) * 60 + parseInt(parts[9], 10);
      if (parts[7] != '-') { // This is supposed to be backwards.
        tzOffsetFeedMin = -tzOffsetFeedMin;
      }
    }
    return new Date(d.getTime() + tzOffsetFeedMin * 60 * 1000);
  }

  parts = DATE_REGEX.exec(rfc3339);
  if (parts && parts.length > 0) {
    return new Date(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
  }
  return null;
};

/**
 * Fires once per minute to redraw extension icon.
 */
function redraw() {
  canvasAnimation_.animate();
};

/**
 * Returns the current time in milliseconds.
 * @return {Number} Current time in milliseconds.
 */
function getCurrentTime() {
  return (new Date()).getTime();
};

/**
 * Called when the user clicks on extension icon and opens calendar page.
 */
function onClickAction() {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs) {
    var tab = tabs[0];
    if (tab.url && tab.url.indexOf('when2meet.com') != -1) {
        console.log('Icon clicked!');

        cb = function(events) {
            console.log('Callback entered!');
            var port = chrome.tabs.connect(tab.id, {name: 'when2meet'});
            var blackoutlist = [];
            for (var i = 0; i < events.length; i++) {
                if (!events[i].isAllDay) {
                    var datum = {
                        'start': events[i].startTime.getTime(),
                        'end': events[i].endTime.getTime(),
                        'title': events[i].title
                    }
                    blackoutlist.push(datum);
                }
            }
            port.postMessage({data: blackoutlist});
        }

        CalendarManager.pollServer(cb);
    } else {
    }
  });
};

/**
 * Initializes everything.
 */
function init() {
  canvasAnimation_ = new CanvasAnimation();

  chrome.browserAction.setIcon({path: '../images/icon-16.gif'});
  window.setInterval(redraw, DRAW_INTERVAL);

  chrome.browserAction.onClicked.addListener(function(tab) {
    onClickAction();
  });
};

//Adding listener when body is loaded to call init function.
window.addEventListener('load', init, false);
