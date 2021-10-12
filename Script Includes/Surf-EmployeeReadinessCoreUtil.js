var EmployeeReadinessCoreUtil = Class.create();
EmployeeReadinessCoreUtil.prototype = {
  initialize: function () {},

  getUserReadinessStatus: function (type, userSysId, location) {
    if (!userSysId) {
      return {
        error: true,
        error_message: gs.getMessage("Empty user sys id provided"),
      };
    }

    var userResult = this.getUserInfo(type, userSysId);
    var statusResult = this.getUserMasterStatus(type, userSysId);
    var reqsResult = [];
    if (!statusResult.error)
      reqsResult = this.getReqResults(
        statusResult.userReadinessSysId,
        location
      );

    return {
      user_result: userResult,
      status_result: statusResult,
      reqs: reqsResult,
    };
  },

  getUserInfo: function (type, userSysId) {
    if (type === "employee") {
      var userGr = new GlideRecordSecure("sys_user");
      if (userGr.get(userSysId)) {
        return {
          error: false,
          name: userGr.getValue("name"),
          title: userGr.getValue("title"),
          location: userGr.getDisplayValue("location"),
        };
      }
    } else if (type === "visitor") {
      var visitorGr = new GlideRecord("sn_imt_core_visitor");
      if (visitorGr.get(userSysId)) {
        return {
          error: false,
          name: visitorGr.getValue("visitor_name"),
          title: "",
          location: visitorGr.getValue("company"),
        };
      }
    }
    return {
      error: true,
      error_message: gs.getMessage("User not found in user table"),
    };
  },

  getStatusMessage: function (cleared) {
    return cleared ? gs.getMessage("Cleared") : gs.getMessage("Not cleared");
  },

  getUserMasterStatus: function (type, userSysId, location) {
    var gr = new GlideRecordSecure("sn_imt_core_health_and_safety_user");
    var uniqueField = type === "employee" ? "user" : "visitor";
    gr.addQuery(uniqueField, userSysId);
    gr.query();
    if (gr.next()) {
      var cleared = gr.getValue("requirements_status") === "cleared";
      //var message = this.getStatusMessage(cleared); //Replaced the line with below for DFCT0140638 - PN
      var message =
        type === "employee"
          ? RequirementStatusUtil.getLocationAwareStatus(gr, location)
          : gr.getDisplayValue("requirement_status");

      return {
        error: false,
        cleared: cleared,
        message: message,
        userReadinessSysId: gr.getUniqueValue(),
      };
    }
    return {
      error: true,
      cleared: false,
      message: message,
      error_message: "no_entry_in_health_and_safety_user_table",
    };
  },

  getReqResults: function (employeeReadinessUserSysId, location) {
    var reqsGr = new GlideRecordSecure(
      "sn_imt_core_employee_health_and_safety_requirement"
    );
    reqsGr.addQuery("health_and_safety_user", employeeReadinessUserSysId);
    reqsGr.addQuery("health_and_safety_requirement.active", true);
    //reqsGr.orderBy("health_and_safety_requirement.name"); //DFCT0119625 - RC
    reqsGr.orderBy("health_and_safety_requirement.u_order"); //STRY2461810 - RH
    reqsGr.query();
    var reqs = [];
    while (reqsGr.next()) {
      //Line till continue is inherited from OOTB code to fix DFCT0140638 - PN
      var userId = reqsGr.health_and_safety_user.user + "";
      location =
        location ||
        (reqsGr.health_and_safety_user.user &&
          RequirementStatusUtil.guessUsersCurrentLocation(
            reqsGr.health_and_safety_user.user
          )) ||
        (reqsGr.health_and_safety_user.user &&
          reqsGr.health_and_safety_user.user.location);

      if (
        userId &&
        location &&
        !new SafeWorkplaceAudienceUtil().requirementAppliesToLocationAndUser(
          reqsGr.getValue("health_and_safety_requirement"),
          location,
          userId
        )
      ) {
        continue;
      }

      var reqCleared = reqsGr.getValue("requirement_status") === "cleared";
      var validUntil = "";
      var reqActionName = "";
      var reqActionURL = "";
      var reqMobileActionURL = "";
      if (reqsGr.getValue("valid_until") && reqCleared) {
        var currentDateTime = new GlideDateTime();
        var valid_until = new GlideDateTime();
        valid_until.setValue(reqsGr.getValue("valid_until"));
        validUntil = gs.getMessage("Valid until {0}", [
          valid_until.getDisplayValue(),
        ]);
      }
      var reqRefRecord = reqsGr.health_and_safety_requirement.getRefRecord();

      //To add mobile compatible action url
      var rtoMobileUtil = new x_snc_wp_mobile.RTOMobileDisplay();
      var mobileCompatibleActionUrl = rtoMobileUtil.actionableRequirementLink(
        reqsGr.health_and_safety_user.user.sys_id,
        reqsGr.health_and_safety_requirement
      );
      //gs.info("reqRefRecord.actionable " + reqRefRecord.actionable);
      if (reqRefRecord.actionable) {
        //                 gs.info("url target value " + reqRefRecord.getValue("u_url_target"));
        var url_target = gs.nil(reqRefRecord.getValue("u_url_target"))
          ? "_self"
          : reqRefRecord.getValue("u_url_target");
        //                 gs.info("url_target=" + url_target);
        if (reqRefRecord.getValue("action_visibility") === "always_visible") {
          reqActionName = reqRefRecord.getValue("action_name");
          reqActionURL = reqRefRecord.getValue("action_url");
          reqMobileActionURL = mobileCompatibleActionUrl;
          // RC
        } else {
          if (!reqCleared) {
            reqActionName = reqRefRecord.getValue("action_name");
            reqActionURL = reqRefRecord.getValue("action_url");
            reqMobileActionURL = mobileCompatibleActionUrl;
          }
        }
      }
      var req = {
        requirement_cleared: reqCleared,
        requirement_id: reqRefRecord.getValue("sys_id"),
        requirement_name: reqRefRecord.getDisplayValue("name"),
        requirement_table: reqRefRecord.getValue("table"),
        requirement_valid_until: validUntil,
        requirement_action_name: reqActionName,
        requirement_action_url: reqActionURL,
        requirement_action_url_target: url_target,
        requirement_mobile_action_url: reqMobileActionURL,
      };
      reqs.push(req);
    }
    return reqs;
  },
  // RC - added this function from oob
  getUnqualifiedReqResults: function (employeeReadinessUserSysId, location) {
    var reqsGr = new GlideRecordSecure(
      "sn_imt_core_employee_health_and_safety_requirement"
    );
    var reqsList = new sn_imt_core.SafeWorkplaceAudienceUtil().getRequirementsForLocation(
      location,
      employeeReadinessUserSysId
    );
    reqsGr.addQuery("health_and_safety_user", employeeReadinessUserSysId);
    reqsGr.addQuery("health_and_safety_requirement.active", true);
    reqsGr.addEncodedQuery("health_and_safety_requirementIN" + reqsList);
    reqsGr.query();
    var reqs = [];
    while (reqsGr.next()) {
      var reqCleared =
        reqsGr.getValue("unqualified_requirement_status") === "cleared";
      var validUntil = "";
      var reqActionName = "";
      var reqActionURL = "";
      if (reqsGr.getValue("valid_until") && reqCleared) {
        validUntil = gs.getMessage("Valid until {0}", [
          this.getValidUntil(reqsGr).getDisplayValue(),
        ]);
      }
      var reqRefRecord = reqsGr.health_and_safety_requirement.getRefRecord();
      if (reqRefRecord.actionable) {
        if (reqRefRecord.getValue("action_visibility") === "always_visible") {
          reqActionName = reqRefRecord.getValue("action_name");
          reqActionURL = reqRefRecord.getValue("action_url");
        } else {
          if (!reqCleared) {
            reqActionName = reqRefRecord.getValue("action_name");
            reqActionURL = reqRefRecord.getValue("action_url");
          }
        }
      }
      var req = {
        requirement_cleared: reqCleared,
        requirement_name: reqRefRecord.getDisplayValue("name"),
        requirement_table: reqRefRecord.getValue("table"),
        requirement_valid_until: validUntil,
        requirement_action_name: reqActionName,
        requirement_action_url: reqActionURL,
      };
      reqs.push(req);
    }
    return reqs;
  },
  lookupOrInsertVisitor: function (current, producer) {
    var visitorGr = new GlideRecord("sn_imt_core_visitor");
    visitorGr.addQuery("email", producer.visitor_email);
    visitorGr.query();

    if (visitorGr.next()) {
      current.visitor = visitorGr.getUniqueValue();
    } else {
      var newVisitorGr = new GlideRecord("sn_imt_core_visitor");
      newVisitorGr.initialize();
      newVisitorGr.first_name = producer.visitor_first_name;
      newVisitorGr.middle_name = producer.visitor_middle_name;
      newVisitorGr.last_name = producer.visitor_last_name;
      newVisitorGr.phone_number = producer.visitor_phone_number;
      newVisitorGr.email = producer.visitor_email;
      newVisitorGr.company = producer.visitor_company;
      var visitorId = newVisitorGr.insert();

      current.visitor = visitorId;
    }
  },
  /*******************************************************************************************************************
    To send notifications :
        If scheduled visit date is before the no of days configured in the system property 'sn_imt_core.days_to_ask_for_health_data' a notification will be sent immediately asking to provide  health status of visitor and no other notification will be sent. Else a notification will be sent to visitors notifying about their schdeuled visit and the notification askingg for health update will be sent before the no of days mentioned in 'sn_imt_core.days_to_ask_for_health_data'.
    ********************************************************************************************************************/
  sendNotification: function (invitationRec) {
    var sendImmediateNotification = gs.getProperty(
      "sn_imt_core.send_email_to_visitor"
    );
    sendImmediateNotification = sendImmediateNotification.toLowerCase();
    var daysToAskForHealthStatus = gs.getProperty(
      "sn_imt_core.days_to_ask_for_health_data"
    );
    var daysDiff = this._getDayDifference(invitationRec);
    daysDiff = daysDiff.getDayPart();
    if (daysDiff < daysToAskForHealthStatus) {
      gs.eventQueue("sn_imt_core.ask_for_health_data", invitationRec);
    } else if (
      sendImmediateNotification ==
      EmployeeReadinessConstants.ENABLE_NOTIFICATION
    ) {
      gs.eventQueue("sn_imt_core.send.email.to.visitor", invitationRec);
    }
  },

  _getDayDifference: function (invitationGr) {
    var todaysDate = new GlideDateTime();
    var visitDate = new GlideDateTime(invitationGr.visit_date_time);
    var dur = GlideDateTime.subtract(todaysDate, visitDate);
    return dur;
  },

  sendEmailAskingForHealthStatus: function () {
    var daysToAskForHealthStatus = gs.getProperty(
      "sn_imt_core.days_to_ask_for_health_data"
    );
    var minsToAskForHealthStatus =
      daysToAskForHealthStatus *
      (EmployeeReadinessConstants.TO_MINUTES *
        EmployeeReadinessConstants.TO_HOURS);
    var visitorInvitationGr = new GlideRecord("sn_imt_core_visitor_invitation");
    visitorInvitationGr.addQuery(
      "visit_date_time",
      ">=",
      "javascript:gs.beginningOfToday()"
    );
    visitorInvitationGr.addQuery(
      "criteria_status",
      "!=",
      "does_not_meet_criteria"
    );
    visitorInvitationGr.query();
    while (visitorInvitationGr.next()) {
      var dur = this._getDayDifference(visitorInvitationGr);
      var duration = dur.getNumericValue();
      var durationSeconds = duration / EmployeeReadinessConstants.TO_SECONDS;
      var durationMins =
        durationSeconds / EmployeeReadinessConstants.TO_MINUTES;
      durationMins = Math.round(durationMins);
      var minsToAskForHealthStatusMinusOneHour =
        minsToAskForHealthStatus - EmployeeReadinessConstants.TO_MINUTES;
      if (
        (minsToAskForHealthStatus > durationMins &&
          durationMins > minsToAskForHealthStatusMinusOneHour) ||
        minsToAskForHealthStatus == durationMins
      ) {
        var emailGr = new GlideRecord("sys_email");
        emailGr.addQuery("instance", visitorInvitationGr.sys_id.toString());
        emailGr.addEncodedQuery(
          "subjectLIKE" + EmployeeReadinessConstants.HEALTH_STATUS_EMAIL_SUBJECT
        );
        emailGr.query();
        if (!emailGr.next()) {
          gs.eventQueue("sn_imt_core.ask_for_health_data", visitorInvitationGr);
        }
      }
    }
  },

  //STRY2461815:Vaccination Changes EmployeeReadiness
  getUserVaccineReportStatus: function () {
    //return (gs.getProperty('sn_imt_core.testvaccinereport')  == "true" ? true : false);
    var userInfo = new GlideRecord("sys_user");
    userInfo.get(gs.getUserID());
    if (userInfo.location.country) {
      /*Check Collecting Vaccination Status is enabled or not*/
      var vaccinationInfo = new GlideRecord(
        "sn_imt_core_location_privacy_configuration"
      );
      vaccinationInfo.addEncodedQuery(
        "privacy_consent_template=" +
          gs.getProperty(
            "sn_imt_vaccine.vaccine_administration_consent_template_esr"
          ) +
          "^u_collect_vaccination_status=true^location=" +
          userInfo.location.country
      );
      vaccinationInfo.query();
      if (
        vaccinationInfo.next() &&
        gs.hasRole("sn_imt_core.privacy_consent_user")
      ) {
        return true;
      }
    }

    return false;
  },

  //STRY2461815:Vaccination Changes EmployeeReadiness
  getUserVaccineTestStatus: function () {
    //return (gs.getProperty('sn_imt_core.testvaccinetest') == "true" ? true : false);
    var userInfo = new GlideRecord("sys_user");
    userInfo.get(gs.getUserID());
    if (userInfo.location.country) {
      /*Check Collecting Vaccination Status is enabled or not*/
      var vaccinationInfo = new GlideRecord(
        "sn_imt_health_test_location_privacy_configuration"
      );
      vaccinationInfo.addEncodedQuery(
        "u_testing_enabled=true^u_location=" + userInfo.location.country
      );
      vaccinationInfo.query();
      if (vaccinationInfo.next()) {
        return true;
      }
    }
    return false;
  },

  type: "EmployeeReadinessCoreUtil",
};
