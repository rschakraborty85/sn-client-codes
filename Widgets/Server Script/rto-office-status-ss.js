(function () {
  // @note RC
  data.requirement_instruction = gs.getProperty(
    "sn_imt_quarantine.covid_requirement_clearance_message"
  );

  data.current_page = $sp.getParameter("tab");
  data.self_reserve_user = gs.hasRole("sn_wsd_core.self_reserve_user");

  var user = gs.getUser();

  data.hasSeperator =
    $sp.getParameter("tab") == "home" || !$sp.getParameter("tab")
      ? true
      : false;

  var GOOGLE_MAP_APIKEY = gs.getProperty("google.map.key.esc");

  var CAMPUS_TBL = "sn_wsd_core_campus";
  var FACILITIES_TBL = "u_facilities_locations_information";
  var BUILDING_TBL = "sn_wsd_core_building";
  var LOCATION_TBL = "cmn_location";

  /* 
    use default santa clara hq location for:
  	1. browser geolocation service is off
    2. the user has no location assigned i.e, recent hires
  */

  var DEFAULT_LOCATION_ID = gs.getProperty("location.santaclara.sysid"); // HQ 2225 Lawson Lane Santa Clara, CA 95054
  var ASSIGNED_LOCATION_ID = gs.getUser().getLocation();
  var WPS_CATALOG_ID = gs.getProperty("catalog.workplaceservice.sysid"); // url for workplace services wps
  var WPS_CATALOG_ITEM_ID = gs.getProperty(
    "catalog.workplaceservice.item.sysid"
  ); // url for workplace services wps

  var geolocation = new GeolocationUtils();
  data.inputPassed = true;

  // Vaccination Action

  data.reportVaccinationLink = gs.getProperty(
    "sn_imt_quarantine.rto_microsite_report_vaccination_link"
  );
  data.requestTestVaccinationLink = gs.getProperty(
    "sn_imt_quarantine.rto_microsite_request_test_vaccination_link"
  );
  data.submitTestVaccinationLink = gs.getProperty(
    "sn_imt_quarantine.rto_microsite_submit_test_vaccination_link"
  );
  /* if (input && input.user_id) {
    var userGR = new GlideRecord("sys_user");
    if (userGR.get(input.user_id)) {
      data.header_msg =
        userGR.name.toString() + "'s return to workplace status";
      ourUserID = input.user_id;
      data.inputPassed = true;
    }
  }*/

  if (options.title) {
    data.title = options.title;
  } else {
    data.title = "My office status";
  }
  // @note RC
  if (options.page) {
    data.page = options.page;
  }

  if (!input) {
    data.isRemote = false;

    if (ASSIGNED_LOCATION_ID) {
      data.isRemote = checkRemoteStatus(ASSIGNED_LOCATION_ID);
      data.assignedLocation = data.isRemote
        ? "Remote"
        : getFacilityLocation(ASSIGNED_LOCATION_ID);

      if (!data.assignedLocation) {
        data.assignedLocation = getLocationDetail(ASSIGNED_LOCATION_ID); // Seoul, Korea
      }
    } else {
      data.locationError =
        "Your assigned location cannot be found. Please contact support for more information.";
      data.assignedLocation = getFacilityLocation(DEFAULT_LOCATION_ID);
    }
  } else {
    var action = input.action;

    if (action === "findLocation") {
      if (input.target !== "defaultLocation") {
        var nearbyLocation = getNearbyLocation(input.target);
      }
      data.nearbyLocation =
        input.target === "defaultLocation"
          ? getFacilityLocation(DEFAULT_LOCATION_ID)
          : getFacilityLocation(nearbyLocation.loc_id);
    }
  }

  options.title_class = "hidden-xs";

  // RC - STRY2435835
  if (input && input.action == "capture_journey") {
    var current = new GlideRecord(input.table);
    current.get(input.sys_id);
    var graphUtil = new global.journeyGraphUtil();
    graphUtil.processDefinitionBySysId(input.defSysId, current, input.notes);
  }
  // @note RC
  if (data.page == "rtw") {
    /* Update to add Requirement */
    data.final_location = ASSIGNED_LOCATION_ID
      ? data.assignedLocation
      : data.nearbyLocation;
    var util = new sn_imt_core.EmployeeReadinessCoreUtil();
    // data.campus_location = new sn_imt_core.SafeWorkplaceAudienceUtilCustom().getCampusFromCMNLocation(data.assignedLocation);
    var result = util.getUserReadinessStatus(
      "employee",
      gs.getUserID(),
      data.final_location.loc_id
    );
    // console.log(JSON.stringify(result));
    // console.log("Location is " + JSON.stringify(data.final_location));
    var userResult = result.user_result;

    if (userResult.error && userResult.error_message) {
      data.user_error_message = userResult.error_message;
      return;
    }

    data.userFound = true;
    data.userExistsInCoreUserTable = true;
    data.user = userResult.name;
    data.userTitleLocation = "";

    var statusResult = result.status_result;
    if (
      statusResult.error &&
      statusResult.error_message &&
      statusResult.error_message === "no_entry_in_health_and_safety_user_table"
    ) {
      data.userExistsInCoreUserTable = false;
    } else {
      data.cleared = result.status_result.cleared;
      data.cleared_message = result.status_result.message;
      data.reqs = result.reqs;
      data.vaccineReqExists = false;
      if (data.reqs) {
        data.reqslength = result.reqs.length;
      }
    }

    var reservation_table = "sn_wsd_core_reservation";
    var query =
      "active=true^end>=" +
      new GlideDateTime() +
      "^requested_for=" +
      gs.getUserID();
    var order_by_field = "start";

    var recordCount = 0;
    data.reservations = [];
    var gr_reservation = new GlideRecord(reservation_table);
    gr_reservation.addEncodedQuery(query);
    gr_reservation.orderBy(order_by_field);
    gr_reservation.query();
    //	data.hasReservation = (gr_reservation.getRowCount() > 0 ) ? true : false;
    data.req_count = 0;
    while (gr_reservation.next()) {
      var reservation = {};
      var location = gr_reservation.getValue("location");
      reservation.sys_id = gr_reservation.getValue("sys_id");
      reservation.table = reservation_table;
      reservation.start =
        new GlideDateTime(gr_reservation.getValue("start"))
          .getLocalDate()
          .getByFormat("MMM dd, yyyy") +
        " " +
        new GlideDateTime(gr_reservation.getValue("start"))
          .getLocalTime()
          .getByFormat("hh:mm a");
      //	reservation.end = new GlideDateTime(gr_reservation.getValue("end")).getDisplayValue();
      //	reservation.present = gr_reservation.getValue("start") <= new GlideDateTime();
      var requirements_status = validateRequirementStatusForLocation(
        location,
        gs.getUserID(),
        gr_reservation.getValue("start"),
        gr_reservation.getValue("end")
      );
      data.req_count =
        data.req_count + requirements_status.locationRequirements.length;

      if (requirements_status.locationRequirements) {
        reservation.status = requirements_status.statusMessage.toString();
      } else {
        // gs.info(
        //   "Blank Location Requirement Reservation Date is " + reservation.start
        // );
        reservation.status = "No Requirements";
      }
      if (reservation.status == "Cleared") {
        reservation.cleared = "yes";
      } else if (reservation.status == "Not Cleared") {
        reservation.cleared = "no";
      } else {
        reservation.cleared = "no_requirement";
      }

      recordCount++;

      data.reservations.push(reservation);
    }

    data.hasreq = data.req_count > 0 ? true : false;
    data.hasReservation = data.reservations.length > 0 ? true : false;
  }

  /* Update to add Requirement complete */

  /* function to get GlideRecord for reservation and travel users */

  function getGlideRecord(table, query, order_by) {
    var gr = new GlideRecord(table);
    gr.addEncodedQuery(query);
    gr.orderBy(order_by);
    gr.query();
    return gr;
  }

  /**
   * To find nearest office location based on user browser location
   */

  function getNearbyLocation(target) {
    var rLat = target.latitude;
    var rLong = target.longitude;

    var facilityGR = new GlideRecord(FACILITIES_TBL);
    var query = "u_active=true";
    facilityGR.addEncodedQuery(query);
    facilityGR.query();

    while (facilityGR.next()) {
      var fLat = facilityGR.u_location.latitude.getValue();
      var fLong = facilityGR.u_location.longitude.getValue();
      var prevDistance;
      var locationId;

      var currDistance = geolocation.getTwoPointsDistance(
        rLat,
        rLong,
        fLat,
        fLong
      );

      if (!prevDistance) {
        prevDistance = currDistance;
      }

      if (currDistance < prevDistance) {
        prevDistance = currDistance;
        locationId = facilityGR.getValue("u_location");
      }
    }

    return {
      distance: prevDistance,
      loc_id: locationId,
    };
  }

  function checkRemoteStatus(locationId) {
    var isRemote = false;
    var locationGR = new GlideRecord(LOCATION_TBL);
    var hasRecord = locationGR.get(locationId);
    var locationDetail;

    if (hasRecord) {
      isRemote = locationGR.name.includes("Remote") ? true : false;
    } else {
      data.locationError =
        "Facility cannot be located. Please contact HR for more information.";
      return;
    }

    return isRemote;
  }

  function getFacilityLocation(locationId) {
    var facility = {};
    var facilityGR = new GlideRecord(FACILITIES_TBL);
    var query = "u_location=" + locationId;
    facilityGR.addEncodedQuery(query);
    facilityGR.query();

    if (facilityGR.next()) {
      var coordinates = {};
      coordinates.latitude = facilityGR.u_location.latitude.getValue();
      coordinates.longitude = facilityGR.u_location.longitude.getValue();

      var address = {};
      address.street = facilityGR.u_location.street.getValue();
      address.street2 = facilityGR.u_location.u_street2.getValue();
      address.city = facilityGR.u_location.city.getValue();
      address.state = facilityGR.u_location.state.getValue();
      address.zip = facilityGR.u_location.zip.getValue();
      address.country = facilityGR.u_location.country.getValue();

      facility = {
        address: address,
        coordinates: coordinates,
        name: facilityGR.getValue("u_location_name"),
        loc_id: facilityGR.getValue("u_location"),
        sys_id: facilityGR.getValue("sys_id"),
        status: getOfficeStatus(facilityGR.getValue("u_location")),
        google_map: buildMap(coordinates),
        full_address: buildAddress(address),
      };
    } else {
      return false;
    }

    return facility;
  }

  function getLocationDetail(locationId) {
    var loc = {};
    var locGR = new GlideRecord(LOCATION_TBL);
    var query = "sys_id=" + locationId;
    locGR.addEncodedQuery(query);
    locGR.query();

    if (locGR.next()) {
      var coordinates = {};
      coordinates.latitude = locGR.latitude.getValue();
      coordinates.longitude = locGR.longitude.getValue();

      var address = {};
      address.street = locGR.street.getValue();
      address.street2 = locGR.u_street2.getValue();
      address.city = locGR.city.getValue();
      address.state = locGR.state.getValue();
      address.zip = locGR.zip.getValue();
      address.country = locGR.country.getValue();

      loc = {
        address: address,
        coordinates: coordinates,
        name: locGR.getValue("u_location_name"),
        sys_id: locGR.getValue("sys_id"),
        status: getOfficeStatus(locationId),
        google_map: buildMap(coordinates),
        full_address: buildAddress(address),
      };

      return loc;
    }
  }

  function buildMap(coordinates) {
    var BASE_URL = "https://www.google.com";

    return (
      BASE_URL +
      "/maps/embed/v1/place?key=" +
      GOOGLE_MAP_APIKEY +
      "&q=" +
      coordinates.latitude +
      ", " +
      coordinates.longitude
    );
  }

  function buildAddress(address) {
    var fullAddress = "";

    for (prop in address) {
      address[prop] =
        address[prop] === "United States of America" ? "USA" : address[prop];

      if (address[prop] && prop !== "zip") {
        fullAddress +=
          prop !== "country" ? address[prop] + ", " : address[prop];
      }
    }

    return fullAddress;
  }

  function getOfficeStatus(locationId) {
    var openStatus = "";
    var campusGR = new GlideRecord(CAMPUS_TBL);
    var campusQuery = "active=true^u_cmn_location=" + locationId;
    campusGR.addEncodedQuery(campusQuery);
    campusGR.query();

    if (campusGR.next()) {
      var buildingGR = new GlideRecord(BUILDING_TBL);
      var buildingQuery = "active=true^campus=" + campusGR.getUniqueValue();
      buildingGR.addEncodedQuery(buildingQuery);
      buildingGR.query();

      while (buildingGR.next()) {
        if (buildingGR.is_reservable && buildingGR.u_phase) {
          openStatus = "Open - " + buildingGR.u_phase.getDisplayValue();
          break;
        } else if (buildingGR.is_reservable) {
          openStatus = "Open";
        }
      }

      if (!openStatus) {
        openStatus = "Closed";
      }
    } else {
      openStatus = "No Campus";
    }

    return openStatus;
  }

  // Function to get Requirement Status

  function validateRequirementStatusForLocation(location, userId, start, end) {
    var util = new sn_imt_core.EmployeeReadinessCoreUtil();
    var locationRequirementStatus = util.getUnqualifiedReqResults(
      findHealthAndSafetyUser(userId),
      location,
      start,
      end
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
})();
