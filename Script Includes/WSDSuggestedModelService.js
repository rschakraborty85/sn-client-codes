var WSDSuggestedModelService = Class.create();
WSDSuggestedModelService.prototype = {
  initialize: function () {
    try {
      this.error_msg = gs.getMessage("one_click_error_msg");
      this.api_response = {};
      this.defaultQueryString = "";
      this.mostBooked = false;
      this.lastBooked = false;
      this.defaultSuggestionType = "random";
      this.msg = "<WSDSuggestedModelService Logger>";
      this.nl = "\n";
      this.addLog = function (msg) {
        this.msg += this.nl;
        this.msg += msg;
        this.msg += this.nl;
      };
      this.printLog = function () {
        gs.warn("Printing Logs So far " + this.msg);
      };
    } catch (error) {
      gs.error("Error in initialize function " + error);
    }
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

      /**
       * prepare the date time params
       * parse the dates from query string
       * both for today and tomorrow
       */
      var searchString = "";
      var searchStringDefault = String(request.queryParams.q);
      this.defaultQueryString = searchStringDefault;
      var startToday = String(request.queryParams.start);
      var endToday = String(request.queryParams.end);
      var startTomorrow = String(request.queryParams.wsd_start_tomorrow);
      var endTomorrow = String(request.queryParams.wsd_end_tomorrow);

      var favSeats = [];
      if (mostBookedSeat) favSeats.push(mostBookedSeat);
      //favSeats += mostBookedSeat;
      if (lastBookedSeat && mostBookedSeat != lastBookedSeat)
        favSeats.push(lastBookedSeat);

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
      this.printLog();
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
   * @param {String} end @type {date time}
   * @returns
   */
  _makeCallForToday: function (request, response, searchString, start, end) {
    try {
      var when = "today";
      var alreadySuggestedAreaSeats = this._getAlreadySuggestedAreaSeat(
        String(request.queryParams.wsd_area),
        when
      );
      if (alreadySuggestedAreaSeats) {
        searchString += alreadySuggestedAreaSeats + "";
        this.defaultQueryString += alreadySuggestedAreaSeats + "";
      }
      // this.addLog("search string in api make call ; today " + searchString);
      this.addLog(
        "trying with default query to check oob api " + this.defaultQueryString
      );
      var result = this.callReservableAPI(
        request,
        response,
        //searchString,
        this.defaultQueryString,
        start,
        end
      );
      this.addLog(
        "1st result in make api call ; today " + JSON.stringify(result)
      );
      var favSeatDetails = this.getFirstSpace(result);
      this.addLog(
        "after calling fav seat check ; today " + JSON.stringify(favSeatDetails)
      );
      if (
        favSeatDetails != null &&
        favSeatDetails != undefined &&
        favSeatDetails != ""
      ) {
        this._storeSuggestedSpace(favSeatDetails, when);
        this._ifUserReservedForToday(favSeatDetails);
        return favSeatDetails;
      } else {
        searchString = this.defaultQueryString;
        this.addLog("search string in else ; today  " + searchString);
        var tmpStore = this.getFirstSpace(
          this.callReservableAPI(request, response, searchString, start, end)
        );
        this.addLog("after calling tmp store " + JSON.stringify(tmpStore));
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
   *
   * @param {Object} result @type {JSON}
   * @returns
   */
  getFirstSpace: function (result) {
    try {
      this.addLog(
        "result parsed before getting first seat " +
          JSON.stringify(result.reservableUnits)
      );
      if (result.reservableUnits.length > 0) {
        result.reservableUnits = result.reservableUnits[0];
        return result.reservableUnits;
      }
      return null;
    } catch (error) {
      gs.error("Error in getFirstSpace function " + error);
    }

    // return result.reservableUnits.length > 0 ? result.reservableUnits[0] : null;
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

      var alreadySuggestedAreaSeats = this._getAlreadySuggestedAreaSeat(
        String(request.queryParams.wsd_area),
        when
      );
      if (alreadySuggestedAreaSeats) {
        searchString += alreadySuggestedAreaSeats + "";
        this.defaultQueryString += alreadySuggestedAreaSeats + "";
      }

      var result = this.callReservableAPI(
        request,
        response,
        searchString,
        start,
        end
      );

      var favSeatDetails = this.getFirstSpace(result);

      if (
        favSeatDetails != null &&
        favSeatDetails != undefined &&
        favSeatDetails != ""
      ) {
        this._storeSuggestedSpace(favSeatDetails, when);
        this._ifUserReservedForToday(favSeatDetails);
        return favSeatDetails;
      } else {
        searchString = this.defaultQueryString;

        var tmpStore = this.getFirstSpace(
          this.callReservableAPI(request, response, searchString, start, end)
        );

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
      gs.error("ERROR in _makeCallForTomorrow function " + error);
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
    try {
      var RESOURCE_PATH = "/api/sn_wsd_rsv/search/suggested_seat";
      var apiHelper = new WSDApiHelper();
      var searchService = new WSDSearchService();
      var reservableModuleService = new WSDReservableModuleService();
      var restValidator = new WSDRestRequestValidator();
      var shiftValidator = new WSDShiftValidator();
      var shiftService = new WSDShiftService();

      // searchCriteria is expected to be encodedQuery
      this.addLog("in reservable api func , search query is " + searchString);
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

      var alternateSearchOptions = {};
      // load reservable module
      var reservableModule = reservableModuleService.getReservableModule(
        requestObj.reservable_module
      );
      // this.addLog("checking reservableModule IF");
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
      // this.addLog("checking reservableModule IF passed ");
      // determine if module has shift enabled
      var moduleIsTypeShift = WSDUtils.safeBool(
        reservableModule.apply_to_shift
      );

      // validate required fields and format
      var validationResult = restValidator.validateSearchReservableRequest(
        requestObj,
        moduleIsTypeShift
      );
      // this.addLog("checking validationResult IF  ");
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
      // this.addLog("checking validationResult IF  passed ");
      // validate actual search request data against the system, and return proper search request (correct time format etc...)
      var resolverResult = restValidator.validateAndResolveSearchRequest(
        requestObj,
        moduleIsTypeShift
      );
      // this.addLog("checking resolverResult IF  ");
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
      this.addLog("reached till shift check - passed");

      var searchRequest = resolverResult.searchRequest;

      if (moduleIsTypeShift) {
        var shiftValidatorOutcome = shiftValidator.validateShiftAndStartEnd(
          searchRequest.shift,
          searchRequest.startGdt
        );
        // this.addLog("checking shiftValidatorOutcome IF  ");
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
        // this.addLog("checking shiftValidatorOutcome IF passed ");

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
      this.addLog("in exception block of reservable api " + ex);
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
        tracker.u_booked_time.setValue(this._getDateTimeUTC(0));
        tracker.update();
      } else {
        tracker.initialize();
        tracker.u_location = current.location.sys_id + "";
        tracker.u_user = current.requested_for.sys_id + "";
        tracker.u_area = current.location.area.sys_id + "";
        tracker.u_booked_time.setValue(this._getDateTimeUTC(0));
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
      //u_location.ref_sn_wsd_core_area.building.sys_id=
      this.addLog("do i get when ? " + when);
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
      this.addLog("RC suggested seat query " + tracker.getEncodedQuery());
      while (tracker.next()) {
        //ids.push("^sys_id!=" + tracker.u_location.sys_id + "");
        ids += "^sys_id!=" + tracker.u_location.sys_id;
      }
      if (ids.length > 0) return ids.toString();
      return "";
    } catch (error) {
      gs.error("Error in _getAlreadySuggestedAreaSeat function " + error);
    }
  },
  /**
   *
   * @param {Object} seatDetailsObject
   * @typedef seatDetailsObject Custom JSON
   * @returns {void}
   */
  _storeSuggestedSpace: function (seatDetailsObject, when) {
    try {
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
        tracker.u_last_suggestion_time.setValue(
          when == "today" ? this._getDateTimeUTC() : this._getDateTimeUTC(1)
        );
        if (this.mostBooked) tracker.u_suggestion_type = "most_booked";
        else if (this.lastBooked) tracker.u_suggestion_type = "last_booked";
        else tracker.u_suggestion_type = this.defaultSuggestionType;
        tracker.update();
      } else {
        tracker.initialize();
        tracker.u_location = shrt.sys_id + "";
        tracker.u_user = gs.getUserID() + "";
        tracker.u_area = shrt.area.sys_id + "";
        tracker.u_status = "suggested";
        tracker.u_suggestion_count = 1;
        tracker.u_last_suggestion_time.setValue(
          when == "today" ? this._getDateTimeUTC() : this._getDateTimeUTC(1)
        );
        if (this.mostBooked) tracker.u_suggestion_type = "most_booked";
        else if (this.lastBooked) tracker.u_suggestion_type = "last_booked";
        else tracker.u_suggestion_type = this.defaultSuggestionType;
        tracker.insert();
      }

      return;
    } catch (error) {
      gs.error("Error in _storeSuggestedSpace function " + error);
    }
  },
  /**
   *
   * @returns {String} return current date time in UTC
   */
  _getDateTimeUTC: function (days) {
    try {
      var gdt = new GlideDateTime();
      if (days) {
        gdt.addDaysUTC(days);
      }
      return gdt.getValue();
    } catch (error) {
      gs.error("Error in _getDateTimeUTC function " + error);
    }
  },
  getMostBookedSeat: function (user) {
    try {
      var ga = new GlideAggregate("sn_wsd_rsv_reservation");
      ga.addQuery("requested_for", user);
      ga.addAggregate("COUNT", "location");
      ga.orderByAggregate("COUNT", "location");
      ga.query();
      var i = 0;
      var space = "";
      while (ga.next()) {
        space = ga.getValue("location").toString();
        var count = ga.getAggregate("COUNT", "location");
        if (count >= 3) {
          this.mostBooked = true;
          return space;
        }
      }

      return null;
    } catch (error) {
      gs.error("Error in function getMostBookedSeat " + error);
    }
  },

  getLastBookedSeat: function (user) {
    try {
      var gr = new GlideRecord("sn_wsd_rsv_reservation");
      gr.addEncodedQuery("requested_for=" + user); //Check any filters on state to be kept for finding last reserved space
      gr.orderByDesc("sys_updated_on");
      gr.query();
      var space = "";
      if (gr.next()) {
        space = gr.getValue("location").toString();

        this.lastBooked = true;
        return space;
      }
      return null;
    } catch (error) {
      gs.error("Error in function getLastBookedSeat " + error);
    }
  },

  type: "WSDSuggestedModelService",
};
