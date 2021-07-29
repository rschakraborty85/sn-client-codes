/** wsdUtils - Service function
 * wsd utility class that offers front-end helper methods
 * @param {spUtil} spUtil - service portal utils
 */
function wsdUtils(spUtil, $location) {
  var timeFormat = "HH:mm:ss";
  var timeFormatSimple = "HH:mm";
  var dateFormat = "YYYY-MM-DD";
  var dateTimeFormat = dateFormat + " " + timeFormat;
  var dateTimeSimpleFormat = dateFormat + " " + timeFormatSimple;
  var userTimeZone = null;

  /**
   * initialize function, fetch user's settings
   */
  (function () {
    // time format (including second), based on glide user data.
    timeFormat = g_user_date_time_format.replace(g_user_date_format, "").trim();

    // time format (without second), based on glide user data.
    timeFormatSimple = timeFormat.replace(":ss", "").replace(".ss", "");
    dateFormat = g_user_date_format.toUpperCase();
    dateTimeFormat = dateFormat + " " + timeFormat;
    dateTimeSimpleFormat = dateFormat + " " + timeFormatSimple;
    userTimeZone = moment().tz();
  })();

  /**
   * check if the user's setting timezone (initialized in moment) are different from local machine timezone
   * The time-zone offset is the difference, in minutes, between UTC and local time.
   * Note that this means that the offset is positive if the local timezone is behind UTC and negative if it is ahead.
   * @return {boolean}
   */
  function checkIfUserTimezoneDifferentFromLocalTimezone() {
    var userServerSettingTimeZoneOffset = moment().utcOffset();
    var userClientTimeZoneOffset = new Date().getTimezoneOffset();
    // when timezone is the same, the 2 above variable are expect to be the exact opposite

    return userServerSettingTimeZoneOffset !== userClientTimeZoneOffset * -1;
  }

  /**
   * Get the users time format, e.g., HH:mm:ss a
   * @return {string}
   */
  function getTimeFormat() {
    return timeFormat;
  }

  /**
   * Get the users time format without second, e.g., HH:mm a
   * @return {string}
   */
  function getSimpleTimeFormat() {
    return timeFormatSimple;
  }

  /**
   * Get the users date format, e.g., MM/DD/YYYY
   * @return {string}
   */
  function getDateFormat() {
    return dateFormat;
  }

  /**
   * Get the users date and time format, e.g., MM/DD/YYYY HH:mm:ss a
   * @return {string}
   */
  function getDateTimeFormat() {
    return dateTimeFormat;
  }

  /**
   * Get the date and time in the users format
   * @param {Moment|string} dateTime - Moment or a full date time string as UTC
   * @return {string}
   */
  function getDateTimeInFormat(dateTime) {
    if (!dateTime) return "";
    else if (typeof dateTime === "string")
      return moment.utc(dateTime).tz(userTimeZone).format(dateTimeSimpleFormat);

    return dateTime.tz(userTimeZone).format(dateTimeSimpleFormat);
  }

  /**
   *
   * @param {Moment} dateTime
   * @return {string}
   */
  function getDateInFormat(dateTime) {
    if (!dateTime) return "";
    else if (typeof dateTime === "string")
      return moment.utc(dateTime).tz(userTimeZone).format(dateFormat);

    return dateTime.tz(userTimeZone).format(dateFormat);
  }

  /**
   * For a user formatted datetime, returns the date
   * @param {string} dateTime
   * @returns {string}
   */
  function getDateFromFormattedDateTime(dateTime) {
    return moment(dateTime, dateTimeFormat).format(dateFormat);
  }

  /**
   * Takes a datetime string and converts it into UTC
   * @param {string} dateTime
   * @returns {string}
   */
  function getDateTimeInUtc(dateTime, format) {
    format = format ? format : dateTimeFormat;
    return moment(dateTime, format).utc().second(0).format();
  }

  /**
   * Gets time in utc from moment
   * @param {Moment} dateTimeMmt
   * @return {string}
   */
  function getTimeInUtcFromMoment(dateTimeMmt) {
    return moment(dateTimeMmt).utc().second(0).format();
  }

  /**
   * Get the duration between two times (start, end) as humanized text
   * @param {Moment} start
   * @param {Moment} end
   * @return {string} humanized text, e.g., '1 hour', '30 minutes'
   */
  function getHumanizedTimeDuration(start, end) {
    //console.log("RC wsdUtils start " + start + " " + end);
    var durationInMinutes = moment(end).diff(moment(start)) / 1000 / 60;
    //     console.log(
    //       "RC wsdUtils durationInMinutes " +
    //         durationInMinutes +
    //         " " +
    //         (durationInMinutes % 60)
    //     );
    if (!durationInMinutes || durationInMinutes < 0) return "-";
    var durationInHours =
      durationInMinutes / 60 >= 24 ? durationInMinutes / 60 : 0;

    switch (true) {
      case durationInMinutes < 60:
        var label = durationInMinutes === 1 ? "${minute}" : "${minutes}";
        return formatString("{0} {1}", durationInMinutes, label);
      case durationInMinutes === 60:
        return formatString("{0} {1}", 1, "${hour}");
      case durationInHours >= 24:
        var mins = durationInMinutes % 60 > 0 ? durationInMinutes % 60 : 0;
        //         console.log("RC wsdUtils mins " + mins);
        if (mins > 0)
          return formatString(
            "{0} {1} {2} {3}",
            Math.floor(durationInHours),
            "${hours}",
            mins,
            "${minutes}"
          );
        return formatString("{0} {1}", durationInHours, "${hours}");
      case durationInMinutes > 60:
        var time = moment("1970-01-01 00:00:00");
        time.minutes(durationInMinutes);
        //         console.log("RC wsdUtils in mins " + time.format(dateTimeFormat));
        var minuteLabel = time.minute() === 1 ? "${minute}" : "${minutes}";
        //         console.log("RC wsdUtils in time.minute() " + time.minute());
        var hourLabel = time.hour() === 1 ? "${hour}" : "${hours}";
        //         console.log("RC wsdUtils in time.hour() " + time.hour());

        if (time.minute() === 0)
          return formatString("{0} {1}", time.hour(), hourLabel);

        return formatString(
          "{0} {1} {2} {3}",
          time.hour(),
          hourLabel,
          time.minute(),
          minuteLabel
        );
      default:
        return "-";
    }
  }

  /**
   * Returns the difference in minutes of a date time from now
   * @param {string} dateTime - Reservation start or Reservation end date time or GlideDateTime display value
   * @return {number} - returns the difference in minutes. if 30 minutes then 30
   */
  function differenceInMinutesFromNow(dateTime) {
    var now = moment();
    var compareToTime = moment(dateTime);
    return now.diff(compareToTime, "minutes");
  }

  /**
   * Checks if a date is same as today
   * @param {string} dateTime - Reservation start or Reservation end date time or GlideDateTime display value
   * @return {boolean} - Returns true if the date time is today
   */
  function isDateTimeToday(dateTime) {
    var today = moment();
    var momentDateTime = moment(dateTime);
    return momentDateTime.isSame(today, "day");
  }

  /**
   * Checks if the start time is before end time
   * @param {string} end - Reservation start or Reservation end date time or GlideDateTime display value
   * @return {boolean} - Returns true if start is before end
   */
  function isNowBeforeEnd(end) {
    var momentNow = moment();
    var momentEnd = moment(end);
    return momentNow.isBefore(end);
  }

  /**
   * Gets the local time from a utc moment date.
   * @param {Moment|string} dateTime - Date to extract the time from.
   * @returns {string} - Local time section of the date.
   */
  function getTimeFromDate(dateTime) {
    if (!dateTime) return "";
    else if (typeof dateTime === "string")
      return moment.utc(dateTime).tz(userTimeZone).format(timeFormatSimple);

    return dateTime.tz(userTimeZone).format(timeFormatSimple);
  }

  /**
   * Gets string indicating start time, end time and duration between "[start] - [end] ([duration])"
   * @param {Moment} startDateUTC
   * @param {Moment} endDateUTC
   * @returns {string}
   */
  function getStartEndTimeAndDuration(startDateUTC, endDateUTC) {
    var startTime = getTimeFromDate(startDateUTC);
    var endTime = getTimeFromDate(endDateUTC);
    var duration = getHumanizedTimeDuration(startDateUTC, endDateUTC);
    return startTime + " - " + endTime + " (" + duration + ")";
  }

  function makeSentenceCase(str) {
    if (g_text_direction === "ltr")
      return str.charAt(0).toUpperCase() + str.slice(1);

    return str;
  }

  /**
   * Check if a given date is in the past
   * @param {Moment} date - the date value to check against
   * @return {boolean}
   */
  function isDateInThePast(date) {
    // allow date value in the past, but has to be the same day
    if (!date.isBefore(moment().startOf("day"))) return false;

    return date.isBefore(moment().seconds(0).milliseconds(0));
  }

  /**
   * Formats two date strings to and concats them together sererated by a '-'.
   * @param {string} startDate - Date string.
   * @param {string} endDate - Date string.
   * @returns {string}
   */
  function formatReservationDate(startDate, endDate) {
    var formattedDates =
      getDateTimeInFormat(startDate) + " - " + getDateTimeInFormat(endDate);
    return formattedDates;
  }

  /**
   * Formats date string to humanized text.
   * @param {string} updateDate - Date string.
   * @returns {string} - time from now string humanized.
   */
  function formatTimeFromNow(dateString) {
    var updateDate = moment.utc(dateString);
    return updateDate.fromNow();
  }

  /**
   * Rounds up a date time value to nearest half hour
   * 01:00 = 01:00
   * 01:01, 01:29, 01:30 = 01:30
   * 01:31, 01:59, 02:00 = 02:00
   * @param {Moment} dateTime
   * @return {Moment}
   */
  function roundUpDateTime(dateTime) {
    var minutes = dateTime.minutes();

    if (minutes === 0) return dateTime;
    else if (minutes > 0 && minutes < 30) return dateTime.minutes(30);
    else if (minutes > 30 && minutes < 60) return dateTime.minutes(60);

    return dateTime;
  }

  /**
   * set time to given moment object
   * @param {Moment} targetMmt - the moment object to set time to
   * @param {string} time - time string in format of HH:mm
   * @return {Moment}
   */
  function setTimeToMomentObj(targetMmt, time, defaultTime) {
    if (!targetMmt || !time) return targetMmt;

    defaultTime = defaultTime ? defaultTime : "08:00";

    var currentMmt = moment(time, "HH:mm", true);
    if (!currentMmt.isValid()) currentMmt = moment(defaultTime, "HH:mm", true);

    return targetMmt
      .hour(currentMmt.hour())
      .minute(currentMmt.minute())
      .second(0);
  }

  /**
   * Remove letters T and Z from a string
   * @param {string} str
   * @return {string}
   */
  function removeTzFromString(str) {
    return str.replace(/T/, " ").replace(/Z/, "");
  }

  /**
   *
   * @param {object} obj - key value pairs that should be turned into an url friendly string
   * @param {string[] }ignoreFields - keys from the obj not to put in the generated query param string
   * @return {string} - url query param format without question mark
   * @private
   */
  function queryObjectToString(obj, ignoreFields) {
    return Object.keys(obj).reduce(function (total, current) {
      if (ignoreFields.indexOf(current) !== -1) return total;

      total += spUtil.format("{key}={value}&", {
        key: current,
        value: obj[current],
      });
      return total;
    }, "");
  }

  /**
   * @param {string} baseUrl
   * @param {Object.<string, string>} queryParams
   * @return {string|null}
   */
  function createRedirectUrl(baseUrl, queryParams) {
    if (baseUrl.indexOf("?") === -1) baseUrl += "?";
    else if (baseUrl.substring(baseUrl.length - 1) !== "&") baseUrl += "&";

    return baseUrl + queryObjectToString(queryParams, ["id"]); // Skip id as we dont want to end up with a double id in the url as that redirects to the portal homepage
  }

  /**
   * format string. Example: formatString('My string {0} to format {1}, {2}', 'HelloWorld', 123, 'And Bye!') => return: `My string HelloWorld to format 123, And Bye!`
   * @param {string} input - string to format
   * @param {params} arguments - optional params
   * @return {string} formatted string
   */
  function formatString(input) {
    if (!input) return "";

    var args = Array.prototype.slice.call(arguments, 1);
    return input.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] !== "undefined" ? args[number] : match;
    });
  }

  /**
   * @param {string[]} fields - names of fields from an object
   * @param {*} data - json object
   * @param {string} [separator] - string to put in between values
   * @returns {string} - returns string of the values of all the fields combined joined with a space or the value of the separator
   * @private
   */
  function mapFieldsToString(fields, data, separator) {
    if (!separator) separator = " ";

    return fields.reduce(function (total, current, index) {
      var value = data[current];
      if (value) {
        if (index !== 0) total += separator;

        if (value.display_value) total += value.display_value;
        else total += value;
      }

      return total;
    }, "");
  }

  /**
   * @param {string[]} fields - names of fields from an object
   * @param {*} data - json object
   * @returns {*[]} - returns an array of the values in all the fields
   * @private
   */
  function mapFieldsToArray(fields, data) {
    return fields.reduce(function (total, current) {
      if (data[current]) total = total.concat(data[current]);
      return total;
    }, []);
  }

  /**
   * check if array has at least one element
   * @param {object} arr
   * @return {boolean}
   */
  function arrayHasElement(arr) {
    if (!Array.isArray(arr)) return false;

    return arr.length > 0;
  }

  /**
   * Opens the page providede, and applies the query onto the url.
   * @param {string} pageId
   * @param {object} query
   */
  function openPage(pageId, query) {
    var searchQuery = _.merge(
      {
        id: pageId,
      },
      query
    );
    $location.search(searchQuery);
  }

  /**
   * turn flat data (layout mapping), into presentable values or icons. Used in search screen
   * @param {object} value - value given by layout configuration (left, or right)
   * @param {number} [maxLength] - max length to display if icons array is used
   * @return { isIcons: boolean, value: string, icons: string[] }
   */
  function resolveDataToStringValuesOrIcons(value, maxLength) {
    var result = {};
    maxLength = maxLength ? maxLength : 4;
    result.isIcons = Array.isArray(value);

    // value from rest api is mapped in the mapper to string for text value or array for icons, if there are no icons or value display a hyphen
    if (result.isIcons && value.length === 0) {
      result.isIcons = false;
      result.value = "-";
    } else if (result.isIcons) {
      result.icons = value.slice();
      if (result.icons.length > maxLength) {
        var rest = result.icons.splice(maxLength - 1);
        result.icons.push({
          font_awesome_icon: "fa-ellipsis-h",
          short_description: rest.reduce(function (total, item, index) {
            if (item.short_description)
              total += item.short_description || item.name;

            if (index !== rest.length - 1) total += "\n";
            return total;
          }, ""),
        });
      }
    } else result.value = value || "-";

    return result;
  }

  /**
   * Resolve a list into a string
   * @param {Array} arr
   * @param {string} key
   * @param {string} delimiter
   * @return {string}
   */
  function resolveListIntoStr(arr, key, delimiter) {
    if (!arrayHasElement(arr) || !key) return "";
    delimiter = delimiter || ", ";

    return arr.reduce(function (accumulator, element, index) {
      return index === 0
        ? element[key]
        : accumulator + delimiter + element[key];
    }, "");
  }

  /**
   * get browser window's width
   * @return {number}
   */
  function getWindowWidth() {
    return Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
  }

  /**
   * get browser window's height
   * @return {number}
   */
  function getWindowHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    );
  }

  /**
   * Generate a unique identifier
   * @return {string}
   */
  function generateGUID() {
    var dt = new Date().getTime();
    var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );

    return uuid;
  }

  /**
   * Only return added services that are not cancelled
   * @param {AddedExtraServices}
   * @return {boolean}
   */
  function filterAddedServices(service) {
    return !service.cancelFlag;
  }

  return {
    getTimeFormat: getTimeFormat,
    getSimpleTimeFormat: getSimpleTimeFormat,
    getDateFormat: getDateFormat,
    getDateTimeFormat: getDateTimeFormat,
    getDateTimeInFormat: getDateTimeInFormat,
    getDateInFormat: getDateInFormat,
    getDateFromFormattedDateTime: getDateFromFormattedDateTime,
    getDateTimeInUtc: getDateTimeInUtc,
    getTimeInUtcFromMoment: getTimeInUtcFromMoment,
    getHumanizedTimeDuration: getHumanizedTimeDuration,
    isDateInThePast: isDateInThePast,
    formatReservationDate: formatReservationDate,
    formatTimeFromNow: formatTimeFromNow,
    roundUpDateTime: roundUpDateTime,
    removeTzFromString: removeTzFromString,
    queryObjectToString: queryObjectToString,
    createRedirectUrl: createRedirectUrl,
    formatString: formatString,
    mapFieldsToString: mapFieldsToString,
    mapFieldsToArray: mapFieldsToArray,
    arrayHasElement: arrayHasElement,
    openPage: openPage,
    resolveDataToStringValuesOrIcons: resolveDataToStringValuesOrIcons,
    resolveListIntoStr: resolveListIntoStr,
    getWindowWidth: getWindowWidth,
    getWindowHeight: getWindowHeight,
    getTimeFromDate: getTimeFromDate,
    getStartEndTimeAndDuration: getStartEndTimeAndDuration,
    differenceInMinutesFromNow: differenceInMinutesFromNow,
    isDateTimeToday: isDateTimeToday,
    isNowBeforeEnd: isNowBeforeEnd,
    setTimeToMomentObj: setTimeToMomentObj,
    generateGUID: generateGUID,
    filterAddedServices: filterAddedServices,
  };
}
/** wsdUtils - helper provider */
