var EmployeeReadinessCoreUtil = Class.create();
EmployeeReadinessCoreUtil.prototype = {
  initialize: function () {
    this.propertyLookupFn = function (key, altValue) {
      return gs.getProperty(key, altValue);
    };
  },

  getUserReadinessStatus: function (type, userSysId, location) {
    if (!userSysId) {
      return {
        error: true,
        error_message: gs.getMessage("Empty user sys id provided"),
      };
    }

    var userResult = this.getUserInfo(type, userSysId);
    var statusResult = this.getUserMasterStatus(type, userSysId, location);
    var reqsResult = [];
    if (!statusResult.error) {
      reqsResult = this.getReqResults(
        statusResult.userReadinessSysId,
        location
      );
    }

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
          country: userGr.getValue("country"),
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
    return cleared ? gs.getMessage("Cleared") : gs.getMessage("Not Cleared");
  },

  getUserMasterStatus: function (type, userSysId, location) {
    var gr = new GlideRecordSecure("sn_imt_core_health_and_safety_user");
    var uniqueField = type === "employee" ? "user" : "visitor";
    gr.addQuery(uniqueField, userSysId);
    gr.query();
    if (gr.next()) {
      var message =
        type === "employee"
          ? RequirementStatusUtil.getLocationAwareStatus(gr, location)
          : gr.getDisplayValue("requirement_status");
      var cleared = message === "Cleared";

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
    reqsGr.query();
    var reqs = [];
    while (reqsGr.next()) {
      var userId = reqsGr.health_and_safety_user.user + "";
      location =
        location ||
        (reqsGr.health_and_safety_user.user &&
          RequirementStatusUtil.guessUsersCurrentLocation(
            reqsGr.health_and_safety_user.user
          )) ||
        (reqsGr.health_and_safety_user.user &&
          reqsGr.health_and_safety_user.user.location);
      gs.warn("RC debug - getReqResults function ; location is " + location);
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

      var statusField = location
        ? "unqualified_requirement_status"
        : "requirement_status";
      var reqCleared = reqsGr.getValue(statusField) === "cleared";
      var validUntil = "";
      var reqActionName = "";
      var reqActionURL = "";
      var reqMobileActionURL = "";
      var reqActionUrlTarget = "";
      if (reqsGr.getValue("valid_until") && reqCleared) {
        validUntil = gs.getMessage("Valid until {0}", [
          this.getValidUntil(reqsGr).getDisplayValue(),
        ]);
      }
      var reqRefRecord = reqsGr.health_and_safety_requirement.getRefRecord();

      //To add mobile compatible action url
      var rtoMobileUtil = new x_snc_wp_mobile.RTOMobileDisplay();
      var mobileCompatibleActionUrl = rtoMobileUtil.actionableRequirementLink(
        reqsGr.health_and_safety_user.user.sys_id,
        reqsGr.health_and_safety_requirement
      );

      if (reqRefRecord.actionable) {
        if (reqRefRecord.getValue("action_visibility") === "always_visible") {
          reqActionName = reqRefRecord.getValue("action_name");
          reqActionURL = reqRefRecord.getValue("action_url");
          reqMobileActionURL = mobileCompatibleActionUrl;
        } else {
          if (!reqCleared) {
            reqActionName = reqRefRecord.getValue("action_name");
            reqActionURL = reqRefRecord.getValue("action_url");
            reqMobileActionURL = mobileCompatibleActionUrl;
          }
        }
        // @note RC - added target link part of response
        reqActionUrlTarget = reqRefRecord.getValue("u_url_target");
      }
      var req = {
        requirement_cleared: reqCleared,
        requirement_name: reqRefRecord.getDisplayValue("name"),
        requirement_table: reqRefRecord.getValue("table"),
        requirement_valid_until: validUntil,
        requirement_action_name: reqActionName,
        requirement_action_url: reqActionURL,
        requirement_action_url_target: reqActionUrlTarget,
        requirement_id: reqRefRecord.getValue("sys_id"),
        requirement_mobile_action_url: reqMobileActionURL,
      };
      reqs.push(req);
    }
    return reqs;
  },
  // @note - RC - added this new function - STRY2462904
  getRequirementStatusBasedOnReservationDate: function (
    start,
    end,
    valid_until,
    record_sys_id
  ) {
    if (!valid_until) return false;
    var startGdt = new GlideDateTime(start);
    var endGdt = new GlideDateTime(end);
    var validUntilGdt = new GlideDateTime(valid_until);
    var duration = GlideDate.subtract(
      endGdt.getDate(),
      validUntilGdt.getDate()
    ).getDayPart();

    return duration >= 0 ? true : false;
  },
  //@note RC - important - added new param - start and end
  // they are reservation data
  getUnqualifiedReqResults: function (
    employeeReadinessUserSysId,
    location,
    start,
    end
  ) {
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
      // @note - rc added new
      var actualReqCleared = "";
      var actualUsed = false;

      var reqCleared =
        reqsGr.getValue("unqualified_requirement_status") === "cleared";
      var final_req_cleared = "";
      var validUntil = "";
      var reqActionName = "";
      var reqActionURL = "";
      var reqMobileActionURL = "";
      if (reqsGr.getValue("valid_until") && reqCleared) {
        validUntil = gs.getMessage("Valid until {0}", [
          this.getValidUntil(reqsGr).getDisplayValue(),
        ]);
        actualReqCleared = this.getRequirementStatusBasedOnReservationDate(
          start,
          end,
          reqsGr.getValue("valid_until"),
          reqsGr.getUniqueValue()
        );
        actualUsed = true;
        validUntil = actualReqCleared ? validUntil : "";
      }

      // Final Requirement Cleared Value
      final_req_cleared = actualUsed ? actualReqCleared : reqCleared;
      var reqRefRecord = reqsGr.health_and_safety_requirement.getRefRecord();

      var rtoMobileUtil = new x_snc_wp_mobile.RTOMobileDisplay();
      var mobileCompatibleActionUrl = rtoMobileUtil.actionableRequirementLink(
        reqsGr.health_and_safety_user.user.sys_id,
        reqsGr.health_and_safety_requirement
      );
      if (reqRefRecord.actionable) {
        if (reqRefRecord.getValue("action_visibility") === "always_visible") {
          reqActionName = reqRefRecord.getValue("action_name");
          reqActionURL = reqRefRecord.getValue("action_url");
          reqMobileActionURL = mobileCompatibleActionUrl;
        } else {
          if (!final_req_cleared) {
            reqActionName = reqRefRecord.getValue("action_name");
            reqActionURL = reqRefRecord.getValue("action_url");
            reqMobileActionURL = mobileCompatibleActionUrl;
          }
        }
      }
      var req = {
        requirement_ref_record: reqRefRecord.getValue("sys_id"),
        requirement_cleared: actualUsed ? actualReqCleared : reqCleared, //@note RC changed
        requirement_name: reqRefRecord.getDisplayValue("name"),
        requirement_table: reqRefRecord.getValue("table"),
        requirement_valid_until: validUntil,
        requirement_action_name: reqActionName,
        requirement_action_url: reqActionURL,
        requirement_mobile_action_url: reqMobileActionURL,
      };
      reqs.push(req);
    }
    return reqs;
  },

  getValidUntil: function (healthAndSafetyUserToRequirementGr) {
    var EMPLOYEE_HEALTH_VERIFICATION = "de3151dac1111010fa9b0669111834d0";
    var userId =
      healthAndSafetyUserToRequirementGr.getElement(
        "health_and_safety_user.user"
      ) + "";
    var validFor =
      healthAndSafetyUserToRequirementGr.getElement(
        "health_and_safety_requirement.valid_for"
      ) + "";

    if (
      validFor &&
      healthAndSafetyUserToRequirementGr.getValue(
        "health_and_safety_requirement"
      ) === EMPLOYEE_HEALTH_VERIFICATION
    ) {
      var verificationGr = new GlideRecord(
        "sn_imt_monitoring_health_verification"
      );
      verificationGr.addQuery("employee", userId);
      verificationGr.orderByDesc("attestation_date");
      verificationGr.setLimit(1);
      verificationGr.query();

      if (verificationGr.next()) {
        var attestationDate = verificationGr.getValue("attestation_date");
        if (attestationDate) {
          var expiration = new sn_imt_monitoring.HealthVerificationUtil().getExpiration(
            verificationGr
          );
          if (!expiration) {
            var attestationDateTime = new GlideDateTime(attestationDate);
            attestationDateTime.add(
              new GlideDateTime(validFor).getNumericValue()
            );
            return attestationDateTime;
          }

          var now = new GlideDateTime();
          var triggerGdt = expiration.dateTime;
          while (triggerGdt.compareTo(now) === -1) {
            // in past
            triggerGdt.addDaysUTC(1);
          }

          return triggerGdt;
        }
      }
    }

    return new GlideDateTime(
      healthAndSafetyUserToRequirementGr.getValue("valid_until")
    );
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
            If scheduled visit date is before the no of days configured in the system property 'sn_imt_core.days_to_ask_for_health_data' a notification will be sent immediately asking to provide  health status of visitor and no other notification will be sent. Else a notification will be sent to visitors notifying about their scheduled visit and the notification asking for health update will be sent before the no of days mentioned in 'sn_imt_core.days_to_ask_for_health_data'.
        ********************************************************************************************************************/
  sendNotification: function (invitationRec) {
    var sendImmediateNotification = DomainProperty.getProperty(
      this.propertyLookupFn,
      "sn_imt_core.send_email_to_visitor"
    );
    sendImmediateNotification = sendImmediateNotification.toLowerCase();
    var daysToAskForHealthStatus = DomainProperty.getProperty(
      this.propertyLookupFn,
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
    var daysToAskForHealthStatus = DomainProperty.getProperty(
      this.propertyLookupFn,
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
