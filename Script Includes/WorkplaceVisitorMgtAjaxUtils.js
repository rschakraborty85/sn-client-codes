var WorkplaceVisitorMgtAjaxUtils = Class.create();
WorkplaceVisitorMgtAjaxUtils.prototype = Object.extendsObject(
  global.AbstractAjaxProcessor,
  {
    checkPolicyAndDPLMulti: function () {
      var sysIDs = this.getParameter("sysparm_registration_ids");
      var responseArray = [];

      var sysIDsArray = sysIDs.split(",");
      for (var i in sysIDsArray) {
        var resp = this._checkPolicyAndDplServer(sysIDsArray[i]);
        responseArray.push(resp);
      }
      // gs.info("outcome " + JSON.stringify(responseArray));
      var tmp = {};
      tmp.responseArray = responseArray;
      return JSON.stringify(tmp);
    },

    logDplPrintOverrideMulti: function () {
      try {
        var regisNumbers = this.getParameter(
          "sysparm_registration_numbers"
        ).split(",");
        regisNumbers.forEach(function (item) {
          var visitorLogGR = new GlideRecord(
            WorkplaceVisitorManagementConstants.TABLES.VISITOR_LOG
          );
          visitorLogGR.newRecord();
          // gs.info("does it reach this ? " + item);
          var regisGR = new GlideRecord(
            WorkplaceVisitorManagementConstants.TABLES.Visitor_Registration
          );
          if (regisGR.get("number", item)) {
            visitorLogGR.visitor_registration = regisGR.sys_id;
            visitorLogGR.current_state = "dpl_print_override";
            var sysid = visitorLogGR.insert();
            // @note DFCT0146128
            regisGR.state = "checked_in";
            regisGR.update();
          }
          // gs.info("RC sysid " + sysid);
        });
        var vaccineCheckIds = this.getParameter(
          "sysparm_vaccine_registration_numbers"
        );
        // gs.warn("RC vaccine ids " + vaccineCheckIds);
        if (vaccineCheckIds)
          this.storeVaccineCheckResponseMulti(vaccineCheckIds);
        return "";
      } catch (error) {
        gs.error("(function) [logDplPrintOverrideMulti] ERROR " + error);
      }
    },
    // @note RC STRY2462909
    storeVaccineCheckResponseMulti: function (ids) {
      ids.split(",").forEach(function (item) {
        var regisGR = new GlideRecord(
          WorkplaceVisitorManagementConstants.TABLES.Visitor_Registration
        );
        if (regisGR.get("number", item)) {
          // @note DFCT0146128
          regisGR.state = "checked_in";
          regisGR.u_notes =
            "Vaccine check completion is confirmed by " +
            gs.getUserDisplayName();
          regisGR.update();
        }
      });
    },
    // @note RC STRY2462909
    storeVaccineCheckResponse: function (registration_id) {
      var registrationID = this.getParameter("sysparm_registration_id")
        ? this.getParameter("sysparm_registration_id")
        : registration_id;
      // gs.info("RC in storeVaccineCheckResponse " + registrationID);
      if (this._getRegistrationGR(registrationID)) {
        this.regisGR.u_notes =
          "Vaccine check completion is confirmed by " + gs.getUserDisplayName();
        this.regisGR.state = "checked_in";
        this.regisGR.update();
      }
      return;
    },
    _checkPolicyAndDplServer: function (sysID) {
      var response = {};

      if (this._getRegistrationGR(sysID)) {
        response.sys_id = sysID;
        response.number = this.regisGR.number.toString();
        response.visitor_policy_confirmation_required = this.isVisitorPolicyConfirmationRequired(
          sysID
        );
        response.active_dpl = "";
        if (this.regisGR.u_dpl_case) {
          response.active_dpl = this._getDplDetails(this.regisGR.u_dpl_case);
        }
        // @note RC STRY2462909
        response.visitor_vaccine_check = this.isVaccineRequiredHere(sysID);
      }
      return response;
    },

    _getDplDetails: function (dplID) {
      var wpsCaseGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.WPS_CASE
      );
      if (wpsCaseGR.get(dplID)) {
        //   gs.info("RC dplID " + wpsCaseGR.active);
        if (wpsCaseGR.active) {
          return "active";
        } else {
          return "inactive";
        }
      }
    },
    // @note RC DFCT0146128
    changeStateMulti: function () {
      var regisIds = this.getParameter("sysparm_registration_ids").split(",");
      regisIds.forEach(function (item) {
        var regisGR = new GlideRecord(
          WorkplaceVisitorManagementConstants.TABLES.Visitor_Registration
        );
        if (regisGR.get("number", item)) {
          regisGR.state = "checked_in";
          regisGR.update();
        }
      });
    },
    changeState: function () {
      var regisID = this.getParameter("sysparm_registration_id");
      if (this._getRegistrationGR(regisID)) {
        this.regisGR.state = "checked_in";
        this.regisGR.update();
      }
    },
    _getRegistrationGR: function (sysID) {
      var regisGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.Visitor_Registration
      );
      if (regisGR.get(sysID)) {
        this.regisGR = regisGR;
        return true;
      }
      return false;
    },
    // @note RC STRY2462909
    isVaccineRequiredHere: function (regisID) {
      var registration = new GlideRecord("sn_wsd_visitor_visitor_registration");
      registration.get(regisID);
      var printerConfigGR = new GlideRecord(
        "sn_wsd_visitor_printer_configuration"
      );
      printerConfigGR.addQuery("u_building", registration.location + "");
      printerConfigGR.query();
      if (printerConfigGR.next())
        return printerConfigGR.getValue("u_vaccine_check_enabled") == 1
          ? true
          : false;
      return false;
    },
    checkPolicyAndDPL: function (sysID) {
      var response = {};
      var regisID = this.getParameter("sysparm_registration_id");

      var dplID = this.getParameter("sysparm_dpl_case_no");

      if (!regisID) return;
      response.active_dpl = "";
      response.visitor_vaccine_check = false;
      if (dplID) {
        var wpsCaseGR = new GlideRecord(
          WorkplaceVisitorManagementConstants.TABLES.WPS_CASE
        );
        if (wpsCaseGR.get(dplID)) {
          //   gs.info("RC dplID " + wpsCaseGR.active);
          if (wpsCaseGR.active && wpsCaseGR.state != "30") {
            // not inactive and resolved
            response.active_dpl = "active";
          } else {
            response.active_dpl = "inactive";
          }
        }
      }

      response.visitor_policy_confirmation_required = this.isVisitorPolicyConfirmationRequired(
        regisID
      );
      // @note RC STRY2462909
      response.visitor_vaccine_check = this.isVaccineRequiredHere(regisID);
      // gs.info("RC " + JSON.stringify(response));
      return JSON.stringify(response);
    },
    logDplPrintOverride: function () {
      var regisID = this.getParameter("sysparm_registration_id");
      var dplID = this.getParameter("sysparm_dpl_case_no");
      var visitorLogGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.VISITOR_LOG
      );
      visitorLogGR.newRecord();
      visitorLogGR.visitor_registration = regisID;
      visitorLogGR.current_state = "dpl_print_override";
      var sysid = visitorLogGR.insert();
      // gs.info("RC sysid " + sysid);
      return "";
    },
    isVisitorPolicyConfirmationRequired: function (regisID) {
      var regisID = regisID; //this.getParameter('sysparm_registration_id');
      var policyConfirmGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.Policy_Confirmation
      );
      policyConfirmGR.addQuery("visitor_registration", regisID);
      policyConfirmGR.orderByDesc("sys_updated_on");
      policyConfirmGR.setLimit(1);
      policyConfirmGR.query();
      if (policyConfirmGR.next()) {
        return policyConfirmGR.getValue("state");
      }

      return "not_required";
    },
    getVisitorLocation: function () {
      var loc;
      var hostname = this.getParameter("sysparm_host");

      var workplaceProfileGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.Workplace_Profile
      );
      workplaceProfileGR.addQuery("employee", hostname);
      workplaceProfileGR.query();
      if (workplaceProfileGR.next()) {
        var isCampus =
          workplaceProfileGR.workplace_location.sys_class_name ==
          "sn_wsd_core_campus";

        if (isCampus) {
          loc = workplaceProfileGR.getValue("workplace_location");
        } else {
          loc = workplaceProfileGR.workplace_location.building;
        }

        var buildingCountGr = new GlideAggregate(
          WorkplaceVisitorManagementConstants.TABLES.Building_Table
        );
        var bc = buildingCountGr.addQuery("campus", loc);
        bc.addOrCondition("sys_id", loc);
        buildingCountGr.addEncodedQuery(
          "is_reservable=true^u_has_lobby=true^u_phase=phase_4^ORu_phase=phase_3"
        );
        buildingCountGr.addAggregate("COUNT");
        buildingCountGr.query();

        if (buildingCountGr.next()) {
          var count = buildingCountGr.getAggregate("COUNT");

          if (count <= 1) {
            var buildingGr = new GlideRecord(
              WorkplaceVisitorManagementConstants.TABLES.Building_Table
            );
            var gc = buildingGr.addQuery("campus", loc);
            gc.addOrCondition("sys_id", loc);
            buildingGr.addEncodedQuery(
              "is_reservable=true^u_has_lobby=true^u_phase=phase_4^ORu_phase=phase_3"
            );
            buildingGr.query();
            if (buildingGr.next()) {
              var locName = buildingGr.sys_id;
            } else {
              locName = "";
            }
          } else {
            locName = "";
          }
        } else {
          locName = "";
        }
      }

      return locName;
    },

    nowDateTime: function () {
      var gmtGdt = new GlideDateTime();
      var userGdt = new GlideDateTime(
        gmtGdt.getLocalDate() +
          " " +
          gmtGdt.getLocalTime().getByFormat("HH:mm:ss")
      );
      return userGdt;
    },

    getHostTimezone: function () {
      var session = gs.getSession();
      var timeZone = session.getTimeZoneName();

      return timeZone;
    },

    getUserBuilding: function () {
      var workplaceProfile = {};
      var workplaceProfileGR = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.Workplace_Profile
      );
      workplaceProfileGR.addQuery("employee", gs.getUserID());
      workplaceProfileGR.query();
      if (workplaceProfileGR.next()) {
        var workLocationClass =
          workplaceProfileGR.workplace_location.sys_class_name;
        if (
          workLocationClass == "sn_wsd_core_space" ||
          workLocationClass == "sn_wsd_core_floor"
        ) {
          try {
            workplaceProfile.building =
              workplaceProfileGR.workplace_location.building + "";
            workplaceProfile.phase =
              workplaceProfileGR.workplace_location.building.u_phase + "";
          } catch (err) {
            gs.error(
              "ERROR: [WorkplaceVisitorMgtAjaxUtils]::[getUserBuilding] - " +
                err
            );
          }
        } else if (workLocationClass == "sn_wsd_core_building") {
          workplaceProfile.building =
            workplaceProfileGR.getValue("workplace_location") + "";
          workplaceProfile.phase =
            workplaceProfileGR.workplace_location.u_phase + "";
        }

        return JSON.stringify(workplaceProfile);
      }
    },

    isPhase3Building: function () {
      var buildingGr = new GlideRecord(
        WorkplaceVisitorManagementConstants.TABLES.Building_Table
      );
      buildingGr.get(this.getParameter("sysparm_building"));

      if (buildingGr.getValue("u_phase") == "phase_3") {
        return true;
      } else {
        return false;
      }
    },

    isDepartureTimeValid: function () {
      var arrival = new GlideDateTime();
      arrival.setDisplayValue(this.getParameter("sysparm_arrival"));

      var departure = new GlideDateTime();
      departure.setDisplayValue(this.getParameter("sysparm_departure"));

      var returnValue = {};
      returnValue.valid = true;

      var arrivalDate = arrival.getDisplayValue().toString().split(" ")[0];
      var departureDate = departure.getDisplayValue().toString().split(" ")[0];

      arrival.add(WSDVMConstants.DURATION.hour * 2);
      returnValue.validTime = arrival.getDisplayValue();

      if (departure.before(arrival) || arrivalDate != departureDate) {
        returnValue.valid = false;
      }

      return JSON.stringify(returnValue);
    },

    departureSameDayAsArrivalGdt: function () {
      var outcome = {
        valid: true,
        arrival: null,
        departure: null,
        allDay: false,
      };
      var expectedArrival = this.getParameter(
        "sysparm_wsdvm_expected_arrival_1"
      );
      var expectedDeparture = this.getParameter(
        "sysparm_wsdvm_expected_departure_1"
      );

      if (!sn_wsd_visitor.WSDVMUtils.nullOrEmpty(expectedArrival)) {
        var expectedArrivalGdt = new GlideDateTime();
        expectedArrivalGdt.setDisplayValue(expectedArrival);

        // validate if arrival is before start of today
        if (!WSDVMUtils.gdtIsAfterStartToday(expectedArrivalGdt)) {
          outcome.valid = false;

          expectedArrivalGdt = new GlideDateTime();
          expectedArrivalGdt.add(WSDVMConstants.DURATION.hour);
          outcome.arrival = expectedArrivalGdt.getDisplayValue();
        }

        var expectedDepartureGdt;
        if (!sn_wsd_visitor.WSDVMUtils.nullOrEmpty(expectedDeparture)) {
          expectedDepartureGdt = new GlideDateTime();
          expectedDepartureGdt.setDisplayValue(expectedDeparture);
        }

        // if there is no expectedDeparture, or it is not on the same date as arrival, or if the departure is before arrival
        // reset departure to 2 hours ahead from arrival
        if (
          !expectedDepartureGdt ||
          expectedArrivalGdt.getLocalDate() !=
            expectedDepartureGdt.getLocalDate() ||
          WSDVMUtils.gdtIsBefore(expectedDepartureGdt, expectedArrivalGdt)
        ) {
          outcome.valid = false;
          var newDepartureGdt = new GlideDateTime(expectedArrivalGdt);
          newDepartureGdt.add(WSDVMConstants.DURATION.hour * 2);

          // ensure that the departure doesnt get set onto the next day.
          if (
            expectedArrivalGdt.getLocalDate() != newDepartureGdt.getLocalDate()
          ) {
            var expectedArrivalDate = expectedArrivalGdt
              .getDisplayValue()
              .split(" ")[0];
            outcome.departure = expectedArrivalDate + " 23:59:59";
          } else {
            outcome.departure = newDepartureGdt.getDisplayValue();
          }
        }

        // Check if the all day needs to be unchecked
        var arrival = WSDVMUtils.nullOrEmpty(expectedArrival)
          ? String(outcome.arrival)
          : String(expectedArrival);
        var departure = WSDVMUtils.nullOrEmpty(expectedDeparture)
          ? String(outcome.departure)
          : String(expectedDeparture);
        if (
          !WSDVMUtils.nullOrEmpty(arrival) &&
          !WSDVMUtils.nullOrEmpty(departure) &&
          arrival.split(" ")[1] === WSDVMConstants.RP_ALL_DAY.arrival_time &&
          departure.split(" ")[1] === WSDVMConstants.RP_ALL_DAY.departure_time
        ) {
          outcome.allDay = true;
        } else {
          outcome.allDay = false;
        }
      }
      return JSON.stringify(outcome);
    },

    type: "WorkplaceVisitorMgtAjaxUtils",
  }
);
