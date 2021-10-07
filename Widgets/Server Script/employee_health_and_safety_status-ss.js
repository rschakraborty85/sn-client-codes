(function ($sp, input, data, options, gs) {
  data.title = gs.getMessage("Health and Safety Status");
  data.portalSuffix = $sp.getPortalRecord().getDisplayValue("url_suffix");
  data.userType = "employee";
  var util = new sn_imt_core.EmployeeReadinessCoreUtil();
  data.isScreener = gs.getUser().hasRole("sn_imt_core.reader");
  if (options.swToday && options.swToday === "true") {
    data.isScreener = false;
    data.title = gs.getMessage("Manage your overall status");
  }

  var userSysId = $sp.getParameter("user");
  if (userSysId) data.userId = userSysId;

  var view = $sp.getParameter("view");
  if (options.view) {
    view = options.view;
  }
  data.validUrl = true;
  // default bad url messages
  data.invalid_url_message = gs.getMessage("Content not found");
  data.invalid_url_action_message = gs.getMessage(
    "Contact your admin for more info."
  );

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
        // if is screener, and user sys id was not provided in url, show the select employee message
        if (data.isScreener && !userSysId && !input && !isSelfView) {
          data.selId = "";
        } else {
          if (isSelfView) {
            userSysId = gs.getUserID();
            data.userId = userSysId;
          }

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
          );
          var userResult = result.user_result;
          if (userResult.error && userResult.error_message) {
            data.user_error_message = userResult.error_message;
          } else {
            if (
              data.userType === "employee" &&
              new GlidePluginManager().isActive("sn_imt_monitoring") &&
              gs.hasRole("sn_imt_monitoring.monitoring_user") &&
              data.isScreener
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
            }
          }
        }
      }
    } else {
      data.validUrl = false;
    }
  }
})($sp, input, data, options, gs);
