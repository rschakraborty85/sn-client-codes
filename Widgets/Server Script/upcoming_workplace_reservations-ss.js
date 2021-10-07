(function () {
  var view = $sp.getParameter("view");
  var localInput = input; //to safeguard pollution of 'input' via BR or other scripts
  data.user_selected = false;
  var limit = options.items_per_page ? options.items_per_page : 10;
  var util = new EmployeeReadinessCoreUtil();

  function setUserContextAndFilterQuery(filter, queryParam) {
    if (!localInput && view == "self") {
      filter = filter + "^" + queryParam + "=" + gs.getUserID();
      data.user = gs.getUserID();
      data.user_type = "employee";
      data.user_selected = true;
      data.lastLimit = 0;
    }
    if (localInput && localInput.user && localInput.user_type == "employee") {
      filter = filter + "^" + queryParam + "=" + localInput.user;
      data.user = localInput.user;
      data.user_type = "employee";
      data.user_selected = true;
      data.lastLimit = 0;
    }
    if (
      localInput &&
      (localInput.user == "" || localInput.user_type == "visitor")
    ) {
      data.user = "";
      data.user_type = "";
      data.user_selected = false;
    }
    return filter;
  }

  function findHealthAndSafetyUser(user) {
    var healthAndSafetyGr = new GlideRecord(
      "sn_imt_core_health_and_safety_user"
    );
    healthAndSafetyGr.addQuery("user", user);
    healthAndSafetyGr.query();
    healthAndSafetyGr.setLimit(1);
    healthAndSafetyGr.next();
    return healthAndSafetyGr.getUniqueValue();
  }

  function validateRequirementStatusForLocation(location, userId) {
    var locationRequirementStatus = util.getUnqualifiedReqResults(
      findHealthAndSafetyUser(userId),
      location
    );
    var status = locationRequirementStatus.every(function (req) {
      return req.requirement_cleared;
    });
    return {
      status: status,
      statusMessage: util.getStatusMessage(status),
      locationRequirements: locationRequirementStatus,
    };
  }

  function getMyReservations() {
    var reservationRecords = [];
    var recordCount = 0;
    var filter = "active=true^is_parent=true^end>=" + new GlideDateTime();
    var tableName = "sn_wsd_core_reservation";
    filter = setUserContextAndFilterQuery(filter, "requested_for");
    if (data.user_selected) {
      var grReservation = getGlideRecord(tableName, filter, "start");
      while (grReservation.next()) {
        var location = grReservation.getValue("location");
        recordCount++;
        reservationRecords.push({
          sys_id: grReservation.getValue("sys_id"),
          display_field: grReservation.getValue("number"),
          secondary_display: grReservation.getDisplayValue("requested_for"),
          shift: grReservation.getDisplayValue("shift"),
          location: grReservation.getDisplayValue("location"),
          start: new GlideDateTime(grReservation.getValue("start"))
            .getDate()
            .getDisplayValue(),
          end: new GlideDateTime(grReservation.getValue("end"))
            .getDate()
            .getDisplayValue(),
          present: grReservation.getValue("start") <= new GlideDateTime(),
          requirements_status: validateRequirementStatusForLocation(
            location,
            data.user
          ),
          isReservation: true,
        });
      }
    }
    return {
      records: reservationRecords,
      recordCount: recordCount,
    };
  }

  function getMyTravelRequests() {
    var travelRequests = [];
    var recordCount = 0;
    var filter = "request_state=4^active=true^travel_end>=" + new GlideDate();
    filter = setUserContextAndFilterQuery(filter, "employee");
    if (data.user_selected) {
      var grTravel = getGlideRecord(
        "sn_imt_travel_request",
        filter,
        "travel_start"
      );
      while (grTravel.next()) {
        recordCount++;
        var location = grTravel.getValue("location");
        travelRequests.push({
          sys_id: grTravel.getValue("sys_id"),
          display_field: grTravel.getValue("number"),
          secondary_display: grTravel.getDisplayValue("employee"),
          shift: null,
          location: grTravel.getDisplayValue("location"),
          start: grTravel.getDisplayValue("travel_start"),
          end: grTravel.getDisplayValue("travel_end"),
          present: grTravel.getValue("travel_start") <= new GlideDate(),
          requirements_status: validateRequirementStatusForLocation(
            location,
            data.user
          ),
          isTravelRequest: true,
        });
      }
    }
    return {
      records: travelRequests,
      recordCount: recordCount,
    };
  }

  function getGlideRecord(tableName, filter, orderBy) {
    var gr = new GlideRecord(tableName);
    gr.addEncodedQuery(filter);
    gr.orderBy(orderBy);
    gr.query();
    return gr;
  }

  function getMyReservationsAndTravelRequests() {
    var reservations;
    var travelRequests;
    if (new GlidePluginManager().isActive("com.sn_wsd_core")) {
      reservations = getMyReservations();
    }
    if (new GlidePluginManager().isActive("com.sn_imt_travel")) {
      travelRequests = getMyTravelRequests();
    }
    var allRecords = [];
    var allCount = 0;
    if (reservations) {
      allRecords = allRecords.concat(reservations.records);
      allCount += reservations.recordCount;
    }
    if (travelRequests) {
      allRecords = allRecords.concat(travelRequests.records);
      allCount += travelRequests.recordCount;
    }
    data.today = new GlideDate();
    data.records = allRecords;
    data.count = allCount;
    if (localInput && localInput.action == "fetch_more") {
      data.lastLimit = localInput.lastLimit + limit;
    } else {
      data.lastLimit = limit;
    }
    if (reservations) {
      data.hasMore = data.count > limit;
    } else {
      data.hasMore = false;
    }
  }

  getMyReservationsAndTravelRequests();
})();
