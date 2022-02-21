(function ($sp, input, data, options, gs) {
  // @note - RC - added new function
  // assumption - it will always return one msg per call
  function getApplicablePpeMsgs(user, location) {
    var msg = new sn_imt_core.CustomRTORequirementsUtil().getReqResult(
      user,
      "ppe_message",
      location
    );
    if (msg) return msg.toString();
    return "";
  }
  // @note RC - added part of STRY2462909
  function checkIfVaccineRequiredForVisitor(
    wsdVisitorUtil,
    printer_config_sys_id
  ) {
    var printerConfigObj = wsdVisitorUtil.getPrinterConfigGrObj(
      printer_config_sys_id
    );

    return printerConfigObj.u_vaccine_check_enabled.display_value == "true"
      ? true
      : false;
  }

  function checkIfDpl(dplCaseID) {
    if (dplCaseID) {
      var caseGR = new GlideRecord("sn_wsd_case_workplace_case");
      if (caseGR.get(dplCaseID)) {
        return caseGR.active;
      }
    }
    return false;
  }
  data.userType = "employee";

  //STRY2461815 - Vacccine Changes
  {
    //Start
    data.vaccineRequirementId = gs.getProperty(
      "sn_imt_quarantine.rto_microsite_vaccine_req_id"
    );
    //   @note RC - added part of DFCT0146241
    data.vaccineRequirementId2 = gs.getProperty(
      "covid_rtw_vaccination_requirement_sys_id_2"
    );
    data.reportVaccinationLink = gs.getProperty(
      "sn_imt_quarantine.rto_microsite_report_vaccination_link"
    );
    data.requestTestVaccinationLink = gs.getProperty(
      "sn_imt_quarantine.rto_microsite_request_test_vaccination_link"
    );
    data.submitTestVaccinationLink = gs.getProperty(
      "sn_imt_quarantine.rto_microsite_submit_test_vaccination_link"
    );
    //End
  }

  var previewVisitorClicked = false;
  var printVisitorClicked = false;
  var util = new sn_imt_core.EmployeeReadinessCoreUtil();
  var metricUtil = new global.MobileMetricsUtil();
  data.isScreener = gs.getUser().hasRole("sn_imt_core.reader");
  data.accessTempScreen = gs
    .getUser()
    .hasRole("sn_imt_monitoring.monitoring_user");

  data.accessPPE = gs.getUser().hasRole("sn_imt_ppe.front_desk");

  // RC - add default query to visitor picker
  var visitorUtil = new sn_imt_core.RTO_VisitorAppUiUtils();
  var visitorData = visitorUtil.getVisitorRelatedData(data.isScreener);

  data.visitor_query = visitorData.visitor_query;
  data.printer_query = visitorData.printer_query;
  data.printer_display_default = visitorData.printer_display_default;
  data.printer_sys_id_default = visitorData.printer_sys_id_default;

  // RC - end of change

  var userSysId = $sp.getParameter("user");
  var visitorSysId = $sp.getParameter("visitor"); //RC check if visitor id is in url
  if (userSysId) data.userId = userSysId;

  data.loggedInUser = gs.getUserID(); //PN get logged in user ID

  data.mobile = gs.isMobile();
  if (!userSysId && data.mobile) {
    // Initializing to some random value to fx the issue for STRY2200764
    // [Issue: For screener this widget doesnt work when directed through mesp in mobile ]
    data.userId = "none";
  }

  var view = $sp.getParameter("view");

  data.view = view;
  data.validUrl = true;
  // default bad url messages
  data.invalid_url_message = gs.getMessage("Content not found");
  data.invalid_url_action_message = gs.getMessage(
    "Contact your admin for more info."
  );
  // RC - visitor 2nd phase ; STRY2443341
  data.wsd_default_printer = null;
  var wsdVisitorUtil = new sn_wsd_visitor.WVM_VisitorUiUtils();

  // view is missing from the url
  if (!view) {
    data.validUrl = false;
  } else {
    // valid parameters sent
    var isSelfView = view === "self";
    var isScreenerView = view === "screener";
    if (isScreenerView || isSelfView) {
      if (!data.isScreener && isScreenerView) {
        data.validUrl = false;
        data.invalid_url_message = gs.getMessage(
          "You need to get permission to see this data"
        );
        data.invalid_url_action_message = gs.getMessage(
          "Contact your admin for permission."
        );
      } else {
        // if is screener, and user sys id was not provided in url,
        // show the select employee message

        if (
          data.isScreener &&
          !userSysId &&
          !visitorSysId &&
          !input &&
          !isSelfView
        ) {
          // RC - visitor 2nd phase ; STRY2443341
          //var wsdVisitorUtil = new sn_wsd_visitor.WVM_VisitorUiUtils();
          data.wsd_default_printer = wsdVisitorUtil.getDefaultPrinterForLoggedInUser();
          data.wsd_visitor_query = wsdVisitorUtil.getVisitorQueryBasedOnPrinter(
            data.wsd_default_printer.value
          );

          data.selId = "";
        } else {
          if (isSelfView) {
            userSysId = gs.getUserID();
            data.userId = userSysId;
          } else if (visitorSysId) {
            data.userType = "visitor";
            data.userId = visitorSysId;
            userSysId = visitorSysId;
          }

          // RC
          // get the user id from the 'input' when the dropdown changes
          if (
            input &&
            input.action &&
            input.action === "fetch_user_status" &&
            input.sysparm_details &&
            input.type
          ) {
            userSysId = input.sysparm_details;
            data.userId = userSysId;
            data.userType = input.type;
            if (data.mobile && data.userType == "visitor") {
              var metricUtil = new global.MobileMetricsUtil();
              metricUtil.recordAction(
                "DXP Mobile Team",
                "Return to Workplace",
                "Scan visitor",
                "",
                "",
                "",
                "",
                "",
                "now_mobile"
              );
            }
          }
          if (
            input &&
            input.action &&
            (input.action === "preview_visitor_badge" ||
              input.action === "print_visitor_badge")
          ) {
            userSysId = input.sysparm_details;
            data.userId = userSysId;
            data.userType = input.type;
            if (input.action === "preview_visitor_badge")
              previewVisitorClicked = true;
            if (input.action === "print_visitor_badge")
              printVisitorClicked = true;
          }

          if (
            input &&
            (input.action === "wsd_printer_changed" ||
              input.action === "fetch_user_status") &&
            input.wsd_printer_config_id
          ) {
            data.userType = input.type;
            if (input.action === "wsd_printer_changed")
              data.wsd_visitor_query = wsdVisitorUtil.getVisitorQueryBasedOnPrinter(
                input.wsd_printer_config_id
              );
            var buildingPhase = wsdVisitorUtil.getBuildingPhase(
              input.wsd_printer_config_id
            );

            data.isEhsRequired =
              parseInt(buildingPhase.split("_")[1], 10) <= 3 ? true : false;

            var registration_response_object = wsdVisitorUtil.getRegistrationGrObj(
              userSysId
            );

            if (registration_response_object) {
              data.is_dpl = checkIfDpl(
                registration_response_object.u_dpl_case.value
              );
              // @note RC - added part of STRY2462909
              data.visitor_vaccine_check = checkIfVaccineRequiredForVisitor(
                wsdVisitorUtil,
                input.wsd_printer_config_id + ""
              );

              data.required_badge_print_data = {
                id: registration_response_object.number.value,
                name:
                  registration_response_object.first_name.value +
                  " " +
                  registration_response_object.last_name.value,
                company:
                  registration_response_object.organization.display_value,
                state: registration_response_object.state.display_value,
                host: wsdVisitorUtil.getHostFromVisit(
                  registration_response_object.source_visit.value
                ),
                date: new GlideDateTime().getDisplayValue(),
              };
              var registrationBuildingID =
                registration_response_object.location.value;
            }
          }

          if (data.userType == "visitor") {
            // if ehs is not required , dont execute below code
            if (!data.isEhsRequired) return;
            // if ehs required but no visitor selected , dont execute
            else if (data.isEhsRequired && !userSysId) return;
            // convert wsd sysid to ehs sysid
            else if (data.isEhsRequired && userSysId) {
              var ehsVisitorObj = wsdVisitorUtil.getEhsVisitorObjFromWsdID(
                userSysId
              );
              // changed the usersysid from wsd to ehs ,
              //    so below ehs code can work as is
              userSysId = ehsVisitorObj.visitor.value;
              data.ehsVisitorInvitationSysID = ehsVisitorObj.sys_id.value;
              data.ehsVisitorRegistrationBuildingID = registrationBuildingID;
            }
          }

          data.userFound = false;

          var userGr = new GlideRecord("sys_user");
          userGr.get(userSysId);
          var location =
            options.useRegularStatus === "true"
              ? userGr.getValue("location")
              : null;

          var result = util.getUserReadinessStatus(
            data.userType,
            userSysId,
            location
          ); // Copied from OOB - POC2
          //var result = util.getUserReadinessStatus(data.userType, userSysId);
          // @debug
          // console.log("RC server result " + JSON.stringify(result));
          var userResult = result.user_result;
          if (userResult.error && userResult.error_message) {
            data.user_error_message = userResult.error_message;
          } else {
            if (
              data.userType === "employee" &&
              new GlidePluginManager().isActive("sn_imt_monitoring") &&
              (gs.hasRole("sn_imt_monitoring.monitoring_user") ||
                gs.hasRole("sn_imt_core.reader"))
            ) {
              var userGr = new GlideRecord("sys_user");
              userGr.get(gs.getUserID());
              new sn_imt_monitoring.HealthScreeningUtil().autoCreateRequest(
                userSysId,
                userGr.getValue("location")
              );
            }
            data.userFound = true;
            data.userExistsInCoreUserTable = true;
            data.user = userResult.name;
            data.userTitleLocation = "";
            if (userResult.title && userResult.location)
              data.userTitleLocation = gs.getMessage("{0}, {1}", [
                userResult.title,
                userResult.location,
              ]);
            else if (userResult.title && !userResult.location)
              data.userTitleLocation = gs.getMessage("{0}", [userResult.title]);
            else if (!userResult.title && userResult.location)
              data.userTitleLocation = gs.getMessage("{0}", [
                userResult.location,
              ]);

            var statusResult = result.status_result;
            if (
              statusResult.error &&
              statusResult.error_message &&
              statusResult.error_message ===
                "no_entry_in_health_and_safety_user_table"
            ) {
              data.userExistsInCoreUserTable = false;
            } else {
              data.cleared = result.status_result.cleared;
              data.cleared_message = result.status_result.message;
              data.reqs = result.reqs;
              data.cleared_none = false;
              // @note RC STRY2462915 - if no requirement - show none
              if (data.reqs.length == 0 && !data.isEhsRequired) {
                data.cleared_message = "No requirements";
                data.cleared_none = true;
                data.cleared = false;
              }
              // @note - RC - added for PPE msg
              if (data.userType === "employee") {
                data.user_ppe_msg = getApplicablePpeMsgs(userSysId, location);
              }
              //STRY2461815 - Vacccine Changes
              //Start
              data.vaccineReqExists = false;

              /*
                  data.reqs.push({'requirement_name':'Covid Vaccine Requirement',
                  requirement_action_name:'view details',
                  requirement_id:'5c5ee7aa81302010fa9bcd132675a426'
                 });
             */
              // @note RC
              for (var iReqLoop = 0; iReqLoop < data.reqs.length; iReqLoop++) {
                if (
                  data.reqs[iReqLoop].requirement_id ==
                  data.vaccineRequirementId
                ) {
                  data.reqs[iReqLoop].requirement_action_name = "View Details";
                  data.reqs[iReqLoop].requirement_action_url = "";
                  data.reqs[iReqLoop].requirement_action_url_target = "";
                  data.vaccineReqExists = true;
                  data.showVaccineReport = util.getUserVaccineReportStatus();
                  data.showVaccineTest = util.getUserVaccineTestStatus();
                }
              }
              //End

              // RC - only for visitor , since status is cleared

              if (data.userType == "visitor") {
                data.visitorBadgeDataObj = visitorUtil.getVisitorDataPrintBadge(
                  data.userId
                );

                if (previewVisitorClicked) {
                  data.visitorBadgePrintObj = visitorUtil.signInVisitor(
                    data.visitorBadgeDataObj,
                    input.printer_value
                  );
                  return;
                }
                if (printVisitorClicked) {
                  visitorUtil.printVisitorBadge(
                    input.data_url,
                    input.badge_sys_id
                  );
                  if (data.mobile && data.userType == "visitor") {
                    var metricUtil = new global.MobileMetricsUtil();
                    metricUtil.recordAction(
                      "DXP Mobile Team",
                      "Return to Workplace",
                      "Print visitor badge",
                      "",
                      "",
                      "",
                      "",
                      "",
                      "now_mobile"
                    );
                  }
                }
              }
            }
          }
        }
      }
    } else {
      data.validUrl = false;
    }
  }
  if (data.mobile && isSelfView) {
    metricUtil.recordAction(
      "DXP Mobile Team",
      "Return to Workplace",
      "My Daily Health Status",
      "",
      "",
      "",
      "",
      "",
      "now_mobile"
    );
  }
})($sp, input, data, options, gs);
