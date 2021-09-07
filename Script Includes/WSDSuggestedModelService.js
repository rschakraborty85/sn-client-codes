var WSDSuggestedModelService = Class.create();
WSDSuggestedModelService.prototype = {
  initialize: function () {
    this.error_msg = gs.getMessage("one_click_error_msg");
    this.api_response = {};
  },
  /**
   * function to provide suggested seat for today and tomorrow
   * @param {HttpRequest} request
   * @param {HttpResponse} response
   * @returns {Object} @type {CustomJSON}
   */
  getSeatDetails: function (request, response) {
    try {
      var mostBookedSeat = this.getMostBookedSeat(gs.getUserID());
      var lastBookedSeat = this.getLastBookedSeat(gs.getUserID());
      //gs.info("RC request package " + JSON.stringify(request.queryParams));

      /**
       * prepare the date time params
       * parse the dates from query string
       * both for today and tomorrow
       */
      var searchString = "";
      var searchStringDefault = String(request.queryParams.q);
      var startToday = String(request.queryParams.start);
      var endToday = String(request.queryParams.end);
      var startTomorrow = String(request.queryParams.wsd_start_tomorrow);
      var endTomorrow = String(request.queryParams.wsd_end_tomorrow);
      //gs.info("RC all dates " + startTomorrow + " " + endTomorrow);

      var favSeats = "";
      if (mostBookedSeat) favSeats += mostBookedSeat;
      if (lastBookedSeat && mostBookedSeat != lastBookedSeat)
        favSeats += "," + lastBookedSeat;
      // // only push if its unique
      // if (lastBookedSeat) {
      //   if (favSeats.indexOf(lastBookedSeat) < 0) favSeats.push(lastBookedSeat);
      // }
      gs.info("RC most or last seat " + favSeats.toString());
      // check if fav seats are available
      if (favSeats) searchString = searchStringDefault + "^sys_idIN" + favSeats;
      // building query needs to be added
      else searchString = searchStringDefault;

      // make oob api call for todays reservation
      // this.api_response.push(
      // JSON.stringify(
      this.api_response.today = this._makeCallForToday(
        request,
        response,
        searchString,
        startToday,
        endToday
      );
      // )
      // );
      // make same call for tomorrow
      // this.api_response.push(
      // JSON.stringify(
      this.api_response.tomorrow = this._makeCallForTomorrow(
        request,
        response,
        searchString,
        startTomorrow,
        endTomorrow
      );
      // )
      // );
      // return JSON.stringify(this.api_response);
      return this.api_response;
    } catch (error) {
      gs.error("ERROR in getSeatDetails function " + error);
    }
  },
  /**
   * make oob api call to get todays reservation
   * @param {HttpRequest} request
   * @param {HttpResponse} response
   * @param {String} searchString @type {encodedQuery}
   * @param {String} start @type {date time}
   * @param end
   * @returns
   */
  _makeCallForToday: function (request, response, searchString, start, end) {
    try {
      var when = "today";

      var alreadySuggestedAreaSeats =
        this._getAlreadySuggestedAreaSeat(
          String(request.queryParams.wsd_area, when)
        ) + "";
      if (alreadySuggestedAreaSeats) {
        searchString += alreadySuggestedAreaSeats + "";
      }

      var result = this.callReservableAPI(
        request,
        response,
        searchString,
        start,
        end
      );
      gs.info(
        "RC is it working TODAY ; trying to find fav seat" +
          JSON.stringify(result)
      );
      var favSeatDetails = this.getFirstSpace(result);
      if (
        favSeatDetails != null &&
        favSeatDetails != undefined &&
        favSeatDetails != ""
      ) {
        //gs.info("RC fav seat response " + JSON.stringify(favSeatDetails));
        this._storeSuggestedSpace(favSeatDetails, when);
        this._ifUserReservedForToday(favSeatDetails);
        return favSeatDetails;
      } else {
        var tmpStore = this.getFirstSpace(
          this.callReservableAPI(request, response, searchString, start, end)
        );
        // gs.info("RC NON fav seat response " + JSON.stringify(tmpStore));
        if (tmpStore) {
          this._ifUserReservedForToday(tmpStore);
          this._storeSuggestedSpace(tmpStore, when);
          return tmpStore;
        }
        // error handling - common message
        return {
          error: true,
          error_msg: this.error_msg,
        };
      }
    } catch (error) {
      gs.error("ERROR in _makeCallForToday function " + error);
    }
  },
  /**
   * make oob api call to get tomorrows reservation
   * @param {HttpRequest} request
   * @param {HttpRequest} response
   * @param {String} searchString @type {encodedQuery}
   * @param {String} start @type {date time}
   * @param {String} end @type {date time}
   * @returns
   */
  _makeCallForTomorrow: function (request, response, searchString, start, end) {
    try {
      var when = "tomorrow";
      var alreadySuggestedAreaSeats =
        this._getAlreadySuggestedAreaSeat(
          String(request.queryParams.wsd_area, when)
        ) + "";
      if (alreadySuggestedAreaSeats) {
        searchString += alreadySuggestedAreaSeats + "";
      }
      var result = this.callReservableAPI(
        request,
        response,
        searchString,
        start,
        end
      );
      //gs.info("RC is it working TOMORROW " + JSON.stringify(result));
      var favSeatDetails = this.getFirstSpace(result);
      if (
        favSeatDetails != null &&
        favSeatDetails != undefined &&
        favSeatDetails != ""
      ) {
        //gs.info("RC fav seat response " + JSON.stringify(favSeatDetails));
        this._storeSuggestedSpace(favSeatDetails, when);
        this._ifUserReservedForToday(favSeatDetails);
        return favSeatDetails;
      } else {
        var tmpStore = this.getFirstSpace(
          this.callReservableAPI(request, response, searchString, start, end)
        );
        //gs.info("RC NON fav seat response " + JSON.stringify(tmpStore));
        if (tmpStore) {
          this._ifUserReservedForToday(tmpStore);
          this._storeSuggestedSpace(tmpStore, when);
          return tmpStore;
        }
        // error handling - common message
        return {
          error: true,
          error_msg: this.error_msg,
        };
      }
    } catch (error) {
      gs.error("ERROR in _makeCallForToday " + error);
    }
  },
  /**
   *
   * @param {HttpRequest} request
   * @param {HttpRequest} response
   * @param {String} searchString
   * @param {String} start @type {date time}
   * @param {String} end @type {date time}
   * @returns
   */
  callReservableAPI: function (request, response, searchString, start, end) {
    var RESOURCE_PATH = "/api/sn_wsd_rsv/search/suggested_seat";
    var apiHelper = new WSDApiHelper();
    var searchService = new WSDSearchService();
    var reservableModuleService = new WSDReservableModuleService();
    var restValidator = new WSDRestRequestValidator();
    var shiftValidator = new WSDShiftValidator();
    var shiftService = new WSDShiftService();
    // //gs.info("RC start and end is " + start + " and " + end + "");
    // searchCriteria is expected to be encodedQuery
    var requestObj = {
      searchCriteria: searchString,
      start: start,
      end: end,
      shift: String(request.queryParams.shift),
      reservable_module: String(request.queryParams.reservable_module),
      reservation_ids: String(request.queryParams.reservation_ids),
      reserved_reservables: String(request.queryParams.reserved_reservables),
      include_unavailable_items: WSDUtils.safeBool(
        request.queryParams.include_unavailable_items
      ),
      include_reservations_within_days: WSDUtils.safeBool(
        request.queryParams.include_reservations_within_days
      ),
      include_standard_services: WSDUtils.safeBool(
        request.queryParams.include_standard_services
      ),
      include_reservable_purposes: WSDUtils.safeBool(
        request.queryParams.include_reservable_purposes
      ),
      next_item_index: Number(request.queryParams.next_item_index),
      page_size: Number(request.queryParams.page_size),
      sort_by: String(request.queryParams.sort_by),
    };

    // If the sort by string ends with :ignore, we'll save the sort option in the user preferences,
    // but ignore it in the call to searchService.search below
    var ignoreSortIndex = requestObj.sort_by.indexOf(":ignore");
    var ignoreSort = ignoreSortIndex >= 0;
    requestObj.sort_by = ignoreSort
      ? requestObj.sort_by.substr(0, ignoreSortIndex)
      : requestObj.sort_by;

    try {
      var alternateSearchOptions = {};
      // load reservable module
      var reservableModule = reservableModuleService.getReservableModule(
        requestObj.reservable_module
      );
      if (!reservableModule) {
        apiHelper.setResponse(
          response,
          500,
          RESOURCE_PATH,
          gs.getMessage("Reservable module is empty or does not exist"),
          requestObj.reservable_module,
          requestObj
        );
        return;
      }

      // determine if module has shift enabled
      var moduleIsTypeShift = WSDUtils.safeBool(
        reservableModule.apply_to_shift
      );

      // validate required fields and format
      var validationResult = restValidator.validateSearchReservableRequest(
        requestObj,
        moduleIsTypeShift
      );
      if (!validationResult.valid) {
        apiHelper.setBadRequestResponse(
          response,
          RESOURCE_PATH,
          gs.getMessage(
            "The search request data is invalid, or the required fields are missing. Please try again"
          ),
          validationResult.msg,
          requestObj
        );
        return;
      }

      // validate actual search request data against the system, and return proper search request (correct time format etc...)
      var resolverResult = restValidator.validateAndResolveSearchRequest(
        requestObj,
        moduleIsTypeShift
      );
      if (!resolverResult.valid) {
        apiHelper.setBadRequestResponse(
          response,
          RESOURCE_PATH,
          gs.getMessage(
            "The search request data is invalid. {0}",
            resolverResult.user_msg
          ),
          null,
          requestObj
        );
        return;
      }

      var searchRequest = resolverResult.searchRequest;
      //gs.info("RC searchRequest " + JSON.stringify(searchRequest));

      if (moduleIsTypeShift) {
        var shiftValidatorOutcome = shiftValidator.validateShiftAndStartEnd(
          searchRequest.shift,
          searchRequest.startGdt
        );
        if (!shiftValidatorOutcome.valid) {
          var shiftInvalidErrorMsg = shiftValidatorOutcome.user_msg
            ? shiftValidatorOutcome.user_msg
            : gs.getMessage(
                "The search request data is invalid. Please try again"
              );
          apiHelper.setBadRequestResponse(
            response,
            RESOURCE_PATH,
            shiftInvalidErrorMsg,
            null,
            requestObj
          );
          return;
        }

        var shiftValidatorPayload = shiftValidatorOutcome.payload;
        searchRequest.startGdt = shiftValidatorPayload.startGdt;
        searchRequest.endGdt = shiftValidatorPayload.endGdt;
        searchRequest.shiftGr = shiftValidatorPayload.shiftGr;
        alternateSearchOptions.reservable_filter =
          shiftService.generateEncodedQueryForLocationsOfShift(
            searchRequest.shift
          );
      }
      searchService.saveSearch(
        searchRequest.reservable_module,
        searchRequest.shift,
        searchRequest.searchCriteria,
        searchRequest.sort_by
      );
      searchRequest.sort_by = ignoreSort ? null : searchRequest.sort_by;
      return searchService.search(
        searchRequest,
        reservableModule,
        alternateSearchOptions
      );
    } catch (ex) {
      apiHelper.setResponse(
        response,
        500,
        RESOURCE_PATH,
        gs.getMessage("Exception occurred! Unable to search"),
        ex,
        {
          requestObj: requestObj,
          stack: ex.stack,
        }
      );
    }
  },

  /**
   *
   * @param {GlideRecord / Workplace reservation} current
   */
  updateSuggestedSeatTracker: function (current) {
    //
    try {
      var tracker = new GlideRecord("sn_wsd_rsv_suggested_space_tracker");
      tracker.addQuery("u_user", current.requested_for.sys_id + "");
      tracker.addEncodedQuery(
        "sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()"
      );
      tracker.query();
      if (tracker.next()) {
        tracker.u_status = "booked";
        tracker.update();
      } else {
        tracker.initialize();
        tracker.u_location = current.location.sys_id + "";
        tracker.u_user = current.requested_for.sys_id + "";
        tracker.u_area = current.location.area.sys_id + "";
        tracker.u_status = "booked";
        tracker.insert();
      }
    } catch (error) {
      gs.error("Error in updateSuggestedSeatTracker function " + error);
    }
  },
  /**
   *
   * @param {Object} seatDetailsObject
   */
  _ifUserReservedForToday: function (seatDetailsObject) {
    //
    try {
      var reserveGR = new GlideRecord("sn_wsd_rsv_reservation");
      reserveGR.addEncodedQuery(
        "sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()"
      );
      reserveGR.query("requested_for", gs.getUserID());
      reserveGR.query();
      seatDetailsObject.oc_reservation_status = {};
      seatDetailsObject.oc_reservation_status.exist = false;
      if (reserveGR.next()) {
        seatDetailsObject.oc_reservation_status.exist = true;
        seatDetailsObject.oc_reservation_status.state = reserveGR.state + "";
        seatDetailsObject.oc_reservation_status.location =
          reserveGR.location + "";
        seatDetailsObject.oc_reservation_status.state_label =
          reserveGR.state.getDisplayValue();
        seatDetailsObject.oc_reservation_status.location_label =
          reserveGR.location.getDisplayValue();
        seatDetailsObject.oc_reservation_status.rsv_id = reserveGR.sys_id + "";
      }
    } catch (error) {
      gs.error("Error in _ifUserReservedForToday function " + error);
    }
  },
  /**
   *
   * @param area_id
   * @param when
   * @returns
   */
  _getAlreadySuggestedAreaSeat: function (area_id, when) {
    try {
    } catch (error) {}
    //u_location.ref_sn_wsd_core_area.building.sys_id=
    //gs.info("RC - find used seat " + area_id);
    var ids = "";
    var tracker = new GlideRecord("sn_wsd_rsv_suggested_space_tracker");
    // when is the last suggestion been made
    // either today or tomorrow
    if (when == "today")
      tracker.addEncodedQuery(
        "u_last_suggestion_timeONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()"
      );
    else if (when == "tomorrow")
      tracker.addEncodedQuery(
        "u_last_suggestion_timeONTomorrow@javascript:gs.beginningOfTomorrow()@javascript:gs.endOfTomorrow()"
      );
    tracker.addQuery("u_area.sys_id", area_id);
    tracker.addQuery("u_status", "suggested");
    tracker.query();
    //gs.info("RC used seat " + tracker.getRowCount());
    while (tracker.next()) {
      //ids.push("^sys_id!=" + tracker.u_location.sys_id + "");
      ids += "^sys_id!=" + tracker.u_location.sys_id;
    }
    if (ids.length > 0) return ids.toString();
    return "";
  },
  /**
   *
   * @param {Object} seatDetailsObject
   * @typedef seatDetailsObject Custom JSON
   * @returns {void}
   */
  _storeSuggestedSpace: function (seatDetailsObject, when) {
    //gs.info("RC _storeSuggestedSpace " + JSON.stringify(seatDetailsObject));
    // var parsedSeatDetails = JSON.parse(seatDetailsObject)
    var shrt = seatDetailsObject;
    var tracker = new GlideRecord("sn_wsd_rsv_suggested_space_tracker");
    if (when == "today")
      tracker.addEncodedQuery(
        "u_last_suggestion_timeONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()"
      );
    else if (when == "tomorrow")
      tracker.addEncodedQuery(
        "u_last_suggestion_timeONTomorrow@javascript:gs.beginningOfTomorrow()@javascript:gs.endOfTomorrow()"
      );
    tracker.addQuery("u_area.sys_id", shrt.area.sys_id + "");
    tracker.addQuery("u_user", gs.getUserID() + "");
    tracker.addQuery("u_status", "!=", "booked");
    tracker.query();
    if (tracker.next()) {
      tracker.u_location = shrt.sys_id + "";
      tracker.u_area = shrt.area.sys_id + "";
      tracker.u_suggestion_count += 1;
      tracker.u_last_suggestion_time = this._getDateTimeUTC();
      tracker.update();
    } else {
      tracker.initialize();
      tracker.u_location = shrt.sys_id + "";
      tracker.u_user = gs.getUserID() + "";
      tracker.u_area = shrt.area.sys_id + "";
      tracker.u_status = "suggested";
      tracker.u_suggestion_count = 1;
      tracker.u_last_suggestion_time = this._getDateTimeUTC();
      tracker.insert();
    }

    return;
  },
  /**
   *
   * @returns {String} return current date time in UTC
   */
  _getDateTimeUTC: function () {
    return new GlideDateTime().getValue();
  },
  getMostBookedSeat: function (user) {
    var ga = new GlideAggregate("sn_wsd_rsv_reservation");
    ga.addQuery("requested_for", user);
    ga.addAggregate("COUNT", "location");
    ga.orderByAggregate("COUNT", "location");
    ga.query();
    var i = 0;
    var space = "";
    while (ga.next() && i++ < 1) {
      space = ga.getValue("location").toString();
      return space;
    }
    //gs.info("getMostBookedSeats==" + space);
    return null;
  },

  getLastBookedSeat: function (user) {
    var gr = new GlideRecord("sn_wsd_rsv_reservation");
    gr.addEncodedQuery("requested_for=" + user); //Check any filters on state to be kept for finding last reserved space
    gr.orderByDesc("sys_updated_on");
    gr.query();
    var space = "";
    if (gr.next()) {
      //gs.info("getLastBookedSeat==" + gr.getValue("location"));
      space = gr.getValue("location").toString();
      return space;
    }
    return null;
  },

  getFirstSpace: function (result) {
    var reservableUnits = "";
    var parser = new global.JSONParser();
    var parsed = parser.parse(global.JSON.stringify(result));
    reservableUnits = parsed.reservableUnits[0];
    // //gs.info(
    //   "RC Scripted Rest API getFirstSpace function Result reservableUnits === " +
    //     reservableUnits
    // );
    if (
      reservableUnits != "" &&
      reservableUnits != undefined &&
      reservableUnits != null
    )
      return reservableUnits;
    return "";
  },

  type: "WSDSuggestedModelService",
};
