(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */
  $sp.isMobile;
  if (input) {
    data.sys_id = input.sys_id;
  }
  // @note property block - this is only for deciding links
  // not imp for clearid
  {
    data.requirement_instruction = gs.getProperty(
      "sn_imt_quarantine.covid_requirement_clearance_message"
    );
    data.vaccineRequirementId = gs.getProperty(
      "covid_rtw_vaccination_requirement_sys_id"
    );
    //   @note RC - added part of DFCT0146241
    data.vaccineRequirementId2 = gs.getProperty(
      "covid_rtw_vaccination_requirement_sys_id_2"
    );
  }
  // req for clearid - data fetch for reservation
  var gr_reservation = new GlideRecord("sn_wsd_core_reservation");
  gr_reservation.get(data.sys_id);
  gr_reservation.query();
  var reservation = {};
  // @note reservation block
  {
    reservation.number = gr_reservation.number.toString();

    reservation.space = gr_reservation.location.getDisplayValue();
    //   @note rc DFCT0145825 - break location in two - desktop
    reservation.location_first = gr_reservation.location.campus.u_cmn_location.street.toString();
    reservation.location_second = gr_reservation.location.campus.u_cmn_location.getDisplayValue();
    reservation.start =
      new GlideDateTime(gr_reservation.getValue("start"))
        .getLocalDate()
        .getByFormat("MMMM dd, yyyy") +
      " " +
      new GlideDateTime(gr_reservation.getValue("start"))
        .getLocalTime()
        .getByFormat("hh:mm a");
    reservation.end =
      new GlideDateTime(gr_reservation.getValue("end"))
        .getLocalDate()
        .getByFormat("MMMM dd, yyyy") +
      " " +
      new GlideDateTime(gr_reservation.getValue("end"))
        .getLocalTime()
        .getByFormat("hh:mm a");
    reservation.date = new GlideDateTime(gr_reservation.getValue("start"))
      .getLocalDate()
      .getByFormat("MMMM dd");
    data.reservation = reservation;
  }

  // @note PPE Message
  // not req for clearid
  {
    var ppe_req = new sn_imt_core.CustomRTORequirementsUtil();

    var ppe_req_result = ppe_req.getReqResult(
      gs.getUserID(),
      gs.getProperty("covid19_ppe_message_identifier"),
      gr_reservation.location.toString()
    );
    data.ppe_info_message = ppe_req_result.toString();
  }

  // @note Overall Status
  // imp for clearid - gets all applicable reqs
  var util = new sn_imt_core.EmployeeReadinessCoreUtil();
  var result = util.getUserReadinessStatus(
    "employee",
    gs.getUserID(),
    gr_reservation.location
  );
  var userResult = result.user_result;
  gs.info("userResult \n" + JSON.stringify(result));

  if (userResult.error && userResult.error_message) {
    data.user_error_message = userResult.error_message;
    return;
  }
  // not req for clearid
  for (var v in result.reqs) {
    var t = result.reqs[v];
    if (t.requirement_name == "Shift / Reservation Requirement") {
      if (data.showShiftUser && t.requirement_cleared)
        data.hideThingsForShiftUser = true;
    }

    if (t.requirement_cleared) {
      v.final_status_message = "Pending";
    } else {
      v.final_status_message = "Complete";
    }
  }

  var safety_user = findHealthAndSafetyUser(gs.getUserID());
  var requirement_result_set = util.getUnqualifiedReqResults(
    safety_user,
    gr_reservation.location,
    gr_reservation.getValue("start"),
    gr_reservation.getValue("end")
  );
  data.reqs = requirement_result_set;
  data.reqs_length = requirement_result_set.length;
  var i = 0;
  if (requirement_result_set.length > 0) {
    data.cleared = true;
    data.cleared_message = "Cleared";
  } else {
    data.cleared = true;
    data.cleared_message = "No Requirement";
  }
  // @note RC added a new array
  data.vaccine_action_list_new = [];

  while (i < requirement_result_set.length) {
    if (!requirement_result_set[i].requirement_cleared) {
      data.cleared = false;
      data.cleared_message = "Not Cleared";
    }

    data.show_req_message = requirement_result_set.length > 0 ? true : false;

    data.reqs[i].requirement_sys_id = requirement_result_set[
      i
    ].requirement_ref_record.toString();

    //  @note RC
    // gs.warn(
    //   "RC req id =" +
    //     requirement_result_set[i].requirement_sys_id.toString() +
    //     "\t pro 1 =" +
    //     data.vaccineRequirementId +
    //     "\t prop 2=" +
    //     data.vaccineRequirementId2
    // );
    if (
      requirement_result_set[i].requirement_sys_id.toString() ==
        data.vaccineRequirementId + "" ||
      requirement_result_set[i].requirement_sys_id.toString() ==
        data.vaccineRequirementId2 + ""
    ) {
      // gs.warn(
      //   "Rc inside if , req id is " +
      //     requirement_result_set[i].requirement_sys_id.toString()
      // );
      data.vaccineReqExists = true;

      data.vaccine_action_list = [];

      var vaccine_action_report_vaccination = {};

      vaccine_action_report_vaccination.name = "Submit Vaccination Status";
      vaccine_action_report_vaccination.url = gs.getProperty(
        "sn_imt_quarantine.rto_microsite_report_vaccination_link"
      );

      data.vaccine_action_list.push(vaccine_action_report_vaccination);
      // @note RC only for vax req - single link
      if (
        requirement_result_set[i].requirement_sys_id.toString() ==
        data.vaccineRequirementId2 + ""
      )
        data.vaccine_action_list_new.push(vaccine_action_report_vaccination);
      // @note RC below is for vax testing req - multi link
      if (
        requirement_result_set[i].requirement_sys_id.toString() ==
        data.vaccineRequirementId
      ) {
        var vaccine_action_request_testing = {};
        vaccine_action_request_testing.name = "Request COVID-19 Test";
        vaccine_action_request_testing.url = gs.getProperty(
          "sn_imt_quarantine.rto_microsite_request_test_vaccination_link"
        );

        data.vaccine_action_list.push(vaccine_action_request_testing);

        var user = new sn_imt_core.EmployeeReadinessCoreUtil().getUserInfo(
          "employee",
          gs.getUserID()
        );
        if (user.country == "US") {
          var vaccine_action_submit_testing = {};
          vaccine_action_submit_testing.name = "Submit COVID-19 Result";
          vaccine_action_submit_testing.url = gs.getProperty(
            "sn_imt_quarantine.rto_microsite_submit_test_vaccination_link"
          );

          data.vaccine_action_list.push(vaccine_action_submit_testing);
        }
      }
      data.vaccine_action_count = data.vaccine_action_list.length;
    }
    i = i + 1;
  }

  // gs.warn("RC array new is " + JSON.stringify(data.vaccine_action_list_new));

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
