(function () {
  // RC - manager widget check
  data.isManager = false;
  var userGr = new GlideRecord("sys_user");
  userGr.addEncodedQuery("managerDYNAMIC90d1921e5f510100a9ad2572f2b477fe");
  userGr.query();
  if (userGr.hasNext()) {
    data.isManager = true;
  }

  var grEmployee = new GlideRecord("u_employee");
  grEmployee.addEncodedQuery(
    "active=true^emailENDSWITH@servicenow.com^u_employee_type!=^sys_id=" +
      gs.getUser().getID()
  );
  grEmployee.query();
  if (!grEmployee.next()) return;

  data.isMobile = gs.isMobile();
  var current_tab = $sp.getParameter("tab");

  if (
    (input && input.action == "myreservation") ||
    (current_tab == "myHealthAndSafety" &&
      $sp.getParameter("showReservationList"))
  ) {
    if (IsEnabledSelfReserve()) {
      if (input && input.cancelRequest) {
        //console.log('hi');
        var wprId = input.cancelRequest;
        var wpr_gr = new sn_wsd_core.selfReserveUtil_WSM();
        wpr_gr.cancelWPRRequest(wprId);
        wpr_gr.checkAndCancelSelfReservation(wprId);
      }

      var util = new selfReservationUtil();
      data.myReservationList = util.getMySelfReservationDetail();
      //return;
    }
  } else if (current_tab == "myHealthAndSafety") {
    if ($sp.getParameter("sys_id") && IsEnabledSelfReserve()) {
      data.my_self_report = $sp.getWidget("widget-sc-cat-item-v2");
      //return;
    }
  }
  data.idcAssistResource = [];
  data.idcStateWiseHelp = [];
  data.idcStateWiseHelpNational = [];
  data.idcAssistResourceIntro = [];

  data.rtw_my_ofice_and_reservation = $sp.getWidget("rto-office-status", {
    title: "My Office & Reservation",
    page: "rtw",
  });

  data.resourcewidget1 = $sp.getWidget("emergency-resource-widget-util", {
    title: "Important resources",
    widget_type: "imp_resources",
    color: "panel-resources",
  });
  data.resourcewidget2 = $sp.getWidget("emergency-resource-widget-util", {
    title: "Work from home resources",
    widget_type: "wfh_resources",
    color: "panel-wfh",
  });

  if (gs.hasRole("manager_success_center_can_read")) {
    data.resourcewidget3 = $sp.getWidget("emergency-resource-widget-util", {
      title: "Manager resources",
      widget_type: "manager_resources",
      color: "panel-manager",
    });
    options.columns = 4;
  } else {
    options.columns = 6;
  }
  // RC - Adding new widget renderer to render horizontal widget with video - start
  data.workplaceSafetyIntro = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.workplaceSafetyIntro,
  });
  // RC - new intro , rtw tab
  // @note RC - added zero top
  data.rtwIntroduction = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.rtwIntroduction,
    show_larger_video: "true",
    zero_top: "true",
  });
  // RC - want to return to workspace content , rtw tab
  data.rtwWantToReturn = $sp.getWidget("rtw-want-to-return", {
    title: "Additional Safety Steps",
    widget_type: "rtw_want_return",
    // color: "resource-rto",
  });
  // RC - imp resource content , rtw tab
  data.rtwImpResources = $sp.getWidget("emergency-resource-widget-util", {
    title: "Important resources",
    widget_type: "rtw_imp_resources",
    //   color: "resource-rto",
  });
  // RC- Shift Status
  if (gs.hasRole("sn_wsd_core.workplace_shift_user")) {
    data.rtwShiftStatus = $sp.getWidget("rtw-shift-status");
  }
  //RC - my return to workplace
  data.rtwStatus = $sp.getWidget("my-return-to-workplace", {
    widget_height: "rto-fixed-height",
  });
  // My team status
  data.rtwMyTeamStatus = $sp.getWidget(
    "rc_employee_health_status_for_manager",
    {}
  );
  // My reservation
  data.rtwMyReservation = $sp.getWidget("rc_my_reservations", {});
  data.rtwHealthStatus = $sp.getWidget("my_current_status", {
    rtw_tab: "true",
    color: "resource-rto",
  });
  // end
  data.shareHealthStatus = $sp.getWidget("health-status-info-util", {
    rec_sys_id: options.shareHealthStatus,
    tabToRedirect: "myHealthAndSafety",
  });
  data.returnToOfficeInfo = $sp.getWidget("home-info-util", {
    rec_sys_id: options.returnToOfficeInfo,
    tabToRedirect: "ourOffices",
  });

  data.my_health_status = $sp.getWidget("my_health_status", {
    lower_widget_rec_sys_id: options.my_health_status,
  });

  data.officeLatestPA = $sp.getWidget("office-latest-info-util", {
    rec_sys_id: options.officeLatestPA,
    hasImage: true,
  });
  data.officeLatestRF = $sp.getWidget("office-latest-info-util", {
    rec_sys_id: options.officeLatestRF,
    hasImage: true,
  });

  data.wfhIntroduction = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.wfhIntroduction,
  });
  data.wfhPerkAllowance = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.wfhPerkAllowance,
  });
  data.wfhItBestPractice = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.wfhItBestPractice,
  });
  data.wfhErgonomicTip = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.wfhErgonomicTip,
  });
  data.wfhKeepingDataSecure = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.wfhKeepingDataSecure,
  });

  data.officeSafetyMeasures1 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.officeSafetyMeasures1,
  });
  data.officeSafetyMeasures2 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.officeSafetyMeasures2,
  });
  data.officeSafetyMeasures3 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.officeSafetyMeasures3,
  });

  data.expectInWorkplace1 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.expectInWorkplace1,
  });
  data.expectInWorkplace2 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.expectInWorkplace2,
  });

  data.travelBestPractice1 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.travelBestPractice1,
  });
  data.travelBestPractice2 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.travelBestPractice2,
  });
  data.travelBestPractice3 = $sp.getWidget("rto-resource-util", {
    rec_sys_id: options.travelBestPractice3,
  });

  data.homeBanner = $sp.getWidget("covid-banner");

  function buildContent(sys_id) {
    var gr = new GlideRecord("sn_imt_quarantine_covid_19_resources");
    if (gr.get(sys_id)) {
      var obj = {};
      obj.title = gr.getDisplayValue("u_title");
      obj.description = gr.u_description.getHTMLValue();
      obj.image = gr.getDisplayValue("u_image");
      return obj;
    }
  }

  data.ourOffice_introduction = buildContent(options.ourOffice_introduction);
  data.ourOffice_MyWorkplace = buildContent(options.ourOffice_MyWorkplace);
  // RC - converted latest phase details from hardcoded content to user controlled
  data.ourOffice_latestPhase = buildContent(options.ourOffice_latestPhase);

  if (input && input.action == "capture_journey") {
    var current = new GlideRecord(input.table);
    current.get(input.sys_id);
    var graphUtil = new global.journeyGraphUtil();
    graphUtil.processDefinitionBySysId(input.defSysId, current, input.notes);
  }

  function IsEnabledSelfReserve() {
    var bReturnFlag = false;
    /* Commented for button control story
            var grSelfReserve = new GlideRecord('sn_imt_checkin_survey_response');
            grSelfReserve.addEncodedQuery('u_shift_reservation_status=Self Reserve^u_user=' + gs.getUserID());
            grSelfReserve.query();
            if (grSelfReserve.next())
            {
                bReturnFlag = true;
            }
            */
    if (gs.hasRole("sn_wsd_core.workplace_user")) bReturnFlag = true;
    return bReturnFlag;
  }
  loadIntro();
  loadIDCAssitanceTab();
  loadStateWiseCovidHelp();

  function loadIDCAssitanceTab() {
    var grOfficeSafety = new GlideRecord(
      "sn_imt_quarantine_covid_19_resources"
    );
    grOfficeSafety.addEncodedQuery(
      "u_tab=idcAssistance^u_type=vertical_widget_1"
    );
    grOfficeSafety.orderBy("u_order");
    grOfficeSafety.query();

    while (grOfficeSafety.next()) {
      var obj = {};
      obj.title = grOfficeSafety.getDisplayValue("u_title");
      obj.description = grOfficeSafety.u_description.getHTMLValue();
      obj.image = grOfficeSafety.getDisplayValue("u_image");
      obj.order = grOfficeSafety.getDisplayValue("u_order");
      if (grOfficeSafety.u_footer_link) {
        obj.footerLink = grOfficeSafety.getDisplayValue("u_footer_link");
        obj.footerText = grOfficeSafety.getDisplayValue("u_footer_text");
      }
      obj.alignmentType = "vertical_widget_1";
      data.idcAssistResource.push(obj);
    }
    // 	  console.log("IDC assist data.idcAssistResource: " + JSON.stringify(data.idcAssistResource));
  }
  function loadIntro() {
    var grOfficeSafety = new GlideRecord(
      "sn_imt_quarantine_covid_19_resources"
    );
    grOfficeSafety.addEncodedQuery(
      "u_tab=idcAssistance^u_type=content^u_title=Introduction"
    );
    grOfficeSafety.orderBy("u_order");
    grOfficeSafety.query();

    while (grOfficeSafety.next()) {
      var obj = {};
      obj.title = grOfficeSafety.getDisplayValue("u_title");
      // 			obj.description = grOfficeSafety.u_description.getHTMLValue();
      obj.description = grOfficeSafety.getDisplayValue("u_description");
      obj.order = grOfficeSafety.getDisplayValue("u_order");
      obj.alignmentType = "content";
      data.idcAssistResourceIntro.push(obj);
    }
  }

  function loadStateWiseCovidHelp() {
    var grOfficeSafety = new GlideRecord(
      "sn_imt_quarantine_covid_19_resources"
    );
    grOfficeSafety.addEncodedQuery("u_tab=idcAssistance^u_type=action_link");
    grOfficeSafety.orderBy("u_order");
    grOfficeSafety.orderBy("u_title");
    grOfficeSafety.query();

    while (grOfficeSafety.next()) {
      var obj = {};
      obj.title = grOfficeSafety.getDisplayValue("u_title");
      obj.order = grOfficeSafety.getDisplayValue("u_order");
      if (grOfficeSafety.u_footer_link) {
        obj.footerLink = grOfficeSafety.getDisplayValue("u_footer_link");
        obj.footerText = grOfficeSafety.getDisplayValue("u_footer_text");
      }
      obj.alignmentType = "action_link";
      if (
        grOfficeSafety.u_title == "National" ||
        grOfficeSafety.getDisplayValue("u_title") == "National"
      ) {
        data.idcStateWiseHelpNational.push(obj);
      } else {
        data.idcStateWiseHelp.push(obj);
      }
    }
    // 	  console.log("IDC assist data.idcAssistResource: " + JSON.stringify(data.idcAssistResource));
  }
})();
