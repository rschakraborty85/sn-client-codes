/** RC - merged with oob ; wsdUtils - Service function
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
   * get user instance timezone used by momentJs. In case the TZ is not supported, fall back to the equivalent known timezone. Example IST is equivalent to
   * @returns {string}
   * @private
   */
  function _resolveAndGetUserTimezone() {
    var userTimeZone = moment().tz();
    var momentTzResetNeeded = false;
    if (!userTimeZone) {
      console.warn(
        "The selected user timezone is not supported by MomentJs Timezone, falling back to equivalent suitable TZ..."
      );
      userTimeZone = window.g_tz;
      momentTzResetNeeded = true;
    }

    switch (userTimeZone) {
      case "IST":
        userTimeZone = "Asia/Kolkata";
        break;
      default:
        break;
    }

    if (!userTimeZone)
      console.error(
        "The selected user timezone is not supported and can not be retrieved. This might cause functionality instability"
      );

    if (momentTzResetNeeded && userTimeZone) {
      console.debug("MomentJs is set to fallback timezone: ", userTimeZone);
      moment.tz.setDefault(userTimeZone);
    }

    return userTimeZone;
  }
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
   * Get the users time zone (e.g., Europe/Amsterdam, US/Pacific)
   * @return {string}
   */
  function getUserTimeZone() {
    if (userTimeZone) return userTimeZone;

    return window.g_tz || "${No time zone found}";
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
   * Get a date in the user's format
   * @param {string} date - date string, which can deviate from known formats
   * @param {string} format - the format for the date supplied (e.g., YYYY-MM-DD, MM.DD.YYYY)
   * @return {string}
   */
  function getCustomDateInFormat(date, format) {
    if (!date || !format) return "";

    return moment(date, format).format(dateFormat);
  }

  /**
   * Get the date in the internal format 'YYYY-MM-DD'
   * RC - removed internalDateFormat - has some error
   * @param {Moment|string} dateTime
   * @return {string}
   */
  function getDateInInternalFormat(dateTime) {
    if (!dateTime) return "";
    else if (typeof dateTime === "string")
      return moment.utc(dateTime).tz(userTimeZone).format(); //internalDateFormat

    return dateTime.tz(userTimeZone).format(); //internalDateFormat
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
    var durationInMinutes = moment(end).diff(moment(start)) / 1000 / 60;

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
        var baseLineTime = moment("1970-01-01 00:00:00"); // used to calculate days later

        time.minutes(durationInMinutes);
        var days = time.diff(baseLineTime, "days");

        var minuteLabel = time.minute() === 1 ? "${minute}" : "${minutes}";
        var hourLabel = time.hour() === 1 ? "${hour}" : "${hours}";
        var dayLabel = days === 1 ? "${day}" : "${days}";
        if (days < 1) {
          // if its on the first of 1970
          // if no minutes are given return hour format
          if (time.minute() === 0)
            return formatString("{0} {1}", time.hour(), hourLabel);

          // hour and minute format
          return formatString(
            "{0} {1} {2} {3}",
            time.hour(),
            hourLabel,
            time.minute(),
            minuteLabel
          );
        } else {
          // if its minutes flat, just show day and hour
          if (time.minute() === 0)
            return formatString(
              "{0} {1} {2} {3}",
              days,
              dayLabel,
              time.hour(),
              hourLabel
            );
          // if everything is given return day hour minute
          return formatString(
            "{0} {1} {2} {3} {4} {5}",
            days,
            dayLabel,
            time.hour(),
            hourLabel,
            time.minute(),
            minuteLabel
          );
        }
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
  function formatReservationDate(startDate, endDate, showTime) {
    var dateTimeFunc = !showTime ? getDateTimeInFormat : getTimeFromDate;
    return formatString(
      "{0} - {1}",
      dateTimeFunc(startDate),
      dateTimeFunc(endDate)
    );
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
   * Construct a label for a reservable containing the full availability on a single day
   * @param {[number[]]} availableTimes
   * @returns {string}
   */
  function constructAvailabilityLabel(availableTimes) {
    if (!arrayHasElement(availableTimes)) return "";

    return availableTimes.reduce(function (acc, current, index) {
      var label = formatString(
        "{0} ${and} {1}",
        getTimeFromDate(current[0]),
        getTimeFromDate(current[1])
      );
      if (index < availableTimes.length - 1) label += ", ";

      return (acc += label);
    }, "");
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
   * Check for actual boolean
   * @param {string|boolean}
   * @return {boolean}
   */
  function safeBool(val) {
    val = String(val).toLowerCase().trim();
    return val === "1" || val === "true";
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
  /**
   * Construct a location string containg information about the location hierarchy
   * By default it will contain the floor, building and campus names
   * @param {Object} reservable
   * @param {Array} [fields]
   * @return {string}
   */
  function constructLocStr(reservable, fields) {
    if (!reservable) return "";

    var locFields = arrayHasElement(fields)
      ? fields
      : ["floor", "building", "campus"];
    var locNames = locFields.reduce(function (acc, current) {
      if (reservable[current] && reservable[current].display_value)
        acc.push(reservable[current].display_value);

      return acc;
    }, []);

    return locNames.join(", ") || "-";
  }

  /**
   * Construct a list of labels for the provided item (location hierarchy, capacity, purposes, services)
   * @param {Object} reservable
   * @param {Object} translations
   * @returns {string[]}
   */
  function constructItemLabels(reservable, translations) {
    if (!reservable || !translations) return [];

    var labels = [];

    // location hierarchy label
    var locStr = constructLocStr(reservable);
    if (locStr) labels.push(locStr);

    // capacity label
    var reservableCapacity =
      reservable.capacity && !isNaN(reservable.capacity)
        ? parseInt(reservable.capacity, 10)
        : -1;
    if (reservableCapacity > 0)
      labels.push(
        formatString(translations.capacity, String(reservableCapacity))
      );

    // purposes label
    var reservablePurposeNames = arrayHasElement(reservable.reservable_purposes)
      ? reservable.reservable_purposes.map(function (reservablePurpose) {
          return reservablePurpose.name;
        })
      : [];
    if (arrayHasElement(reservablePurposeNames))
      labels.push(
        formatString(translations.purposes, reservablePurposeNames.join(", "))
      );

    // services label
    var reservableServiceNames = arrayHasElement(reservable.standard_services)
      ? reservable.standard_services.map(function (reservableStandardService) {
          return reservableStandardService.name;
        })
      : [];
    if (arrayHasElement(reservableServiceNames))
      labels.push(
        formatString(translations.services, reservableServiceNames.join(", "))
      );

    return labels;
  }

  /**
   * Gets the first view option which is flagged as default, in no default first index is returned.
   * @param {ReservableView[]} viewOptions - The view options from which to get the default.
   * @returns {ReservableView || null} - A default reservable view.
   * @private
   */
  function getDefaultReservableView(viewOptions) {
    if (!arrayHasElement(viewOptions)) return null;

    for (var i = 0; i < viewOptions.length; i++) {
      if (viewOptions[i].isDefault) {
        return viewOptions[i];
      }
    }
    return viewOptions[0];
  }
  return {
    getTimeFormat: getTimeFormat,
    getSimpleTimeFormat: getSimpleTimeFormat,
    getDateFormat: getDateFormat,
    getDateTimeFormat: getDateTimeFormat,
    getDateTimeInFormat: getDateTimeInFormat,
    getDateInFormat: getDateInFormat,
    getDateInInternalFormat: getDateInInternalFormat,
    getDateFromFormattedDateTime: getDateFromFormattedDateTime,
    getDateTimeInUtc: getDateTimeInUtc,
    getTimeInUtcFromMoment: getTimeInUtcFromMoment,
    getCustomDateInFormat: getCustomDateInFormat,
    getHumanizedTimeDuration: getHumanizedTimeDuration,
    getUserTimeZone: getUserTimeZone,
    isDateInThePast: isDateInThePast,
    formatReservationDate: formatReservationDate,
    formatTimeFromNow: formatTimeFromNow,
    roundUpDateTime: roundUpDateTime,
    removeTzFromString: removeTzFromString,
    constructAvailabilityLabel: constructAvailabilityLabel,
    queryObjectToString: queryObjectToString,
    createRedirectUrl: createRedirectUrl,
    formatString: formatString,
    mapFieldsToString: mapFieldsToString,
    mapFieldsToArray: mapFieldsToArray,
    arrayHasElement: arrayHasElement,
    safeBool: safeBool,
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
    constructLocStr: constructLocStr,
    constructItemLabels: constructItemLabels,
    getDefaultReservableView: getDefaultReservableView,
  };
}
/** wsdUtils - helper provider */
