var SafeWorkplaceAudienceUtil = Class.create();
SafeWorkplaceAudienceUtil.prototype = {
  // @note - added custom logic to search both in cmn and wsd location hierarchy
  childLocationIsWithinParent: function (parentLocation, childLocation) {
    this.STATIC_LOGGER +=
      "parentLocation/audience=" +
      parentLocation +
      "\t" +
      "childLocation=" +
      childLocation +
      "\n";
    var childLocationGr = new GlideRecord("cmn_location");
    childLocationGr.get(childLocation);
    this.STATIC_LOGGER +=
      "New log ChildLocationDisplay=" + childLocationGr.name + "\n";
    var parentLocationGr = new GlideRecord("cmn_location");
    parentLocationGr.get(parentLocation);
    this.STATIC_LOGGER +=
      "New log ParentLocationDisplay/Audience=" + parentLocationGr.name + "\n";
    this.STATIC_LOGGER +=
      "New log childLocationGr class=" + childLocationGr.sys_class_name + "\n";

    if (childLocationGr.getUniqueValue() === parentLocation) {
      return true;
    }
    // @note rc - custom code - start
    else if (childLocationGr.sys_class_name.toString() == "sn_wsd_core_space") {
      var spaceGR = new GlideRecord("sn_wsd_core_space");
      spaceGR.get(childLocationGr.getUniqueValue());
      this.STATIC_LOGGER +=
        "New log childLocationGr CMN=" +
        spaceGR.campus.u_cmn_location.toString() +
        "\t" +
        " parentLocation/audience=" +
        parentLocation +
        "\n";

      if (spaceGR.campus.u_cmn_location.toString() == parentLocation)
        return true;
    }
    // @note rc - custom code - end
    var tempLoc = childLocationGr.parent;
    while (tempLoc && tempLoc != parentLocation) {
      tempLoc = tempLoc.parent;
    }
    return tempLoc == parentLocation;
  },
  // @note - debugging location checks
  audienceContainsWorkplaceLocation: function (
    audienceId,
    workplaceLocationId
  ) {
    // var rc_log = "debugging audienceContainsWorkplaceLocation\n";
    var audienceGr = new GlideRecord("sn_imt_core_safe_workplace_audience");
    audienceGr.get(audienceId);

    if (!audienceGr.locations) {
      return true;
    }

    return (audienceGr.getValue("locations") || "")
      .split(",")
      .filter(function (location) {
        // rc_log += "filter : location - " + location + "\n";
        return location;
      })
      .some(
        function (location) {
          //   rc_log += "some : location - " + location + "\n";
          return this.childLocationIsWithinParent(
            location,
            workplaceLocationId
          );
        }.bind(this)
      );
  },
  // @note debugging this function
  requirementAppliesToLocationAndUser: function (
    requirementId,
    workplaceLocationId,
    userId
  ) {
    // var rc_log = "debugging requirementAppliesToLocationAndUser\n";
    this.STATIC_LOGGER = "RC Debugging requirementAppliesToLocationAndUser \n";
    var requirementGr = new GlideRecord(
      "sn_imt_core_health_and_safety_requirement"
    );
    requirementGr.get(requirementId);
    this.STATIC_LOGGER += "Requirement details=" + requirementGr.name + "\n";
    if (!requirementGr.audience) {
      return true;
    }
    var exclude = requirementGr.getValue("exclude") === "1";
    var appliesToUser = (requirementGr.getValue("audience") || "")
      .split(",")
      .filter(function (audience) {
        // rc_log += "filter : audience - " + audience + "\n";
        return audience;
      })
      .some(
        function (audience) {
          //   rc_log += "some : audience - " + audience + "\n";
          var one = this.audienceContainsWorkplaceLocation(
            audience,
            workplaceLocationId
          );
          var two = this.userIsInAudience(audience, userId, {
            users: true,
            locations: false,
            departments: true,
            groups: true,
            companies: true,
            roles: true,
            condition: true,
          });
          this.STATIC_LOGGER += "One=" + one + "\t" + "Two=" + two + "\n";
          var result = one && two;
          return result;
        }.bind(this)
      );
    this.STATIC_LOGGER += "appliesToUser=" + appliesToUser + "\n";
    // gs.error(this.STATIC_LOGGER);
    return exclude ? !appliesToUser : appliesToUser;
  },
  // @note RC - important
  getRequirementsForLocation: function (workplaceLocationId, userId) {
    var requirements = [];
    var requirementGr = new GlideRecord(
      "sn_imt_core_health_and_safety_requirement"
    );
    requirementGr.addQuery("active", true);
    requirementGr.query();
    while (requirementGr.next()) {
      if (
        this.requirementAppliesToLocationAndUser(
          requirementGr.getUniqueValue(),
          workplaceLocationId,
          userId
        )
      ) {
        requirements.push(requirementGr.getUniqueValue());
      }
    }
    return requirements;
  },

  initialize: function () {},

  getUsers: function (table, query, result_attribute) {
    var users = [];
    var grRec = new GlideRecord(table);
    grRec.addEncodedQuery(query);
    grRec.query();
    while (grRec.next()) {
      users.push(grRec.getValue(result_attribute));
    }
    return users;
  },

  getUsersForGroups: function (groupIds) {
    table = "sys_user_grmember";
    var query = "user.active=true^group.sys_idIN" + groupIds;
    result_attribute = "user";
    return this.getUsers(table, query, result_attribute);
  },

  getUsersForGroupHierarchy: function (groupIds, allKnownUsers) {
    var users = this.getUsersForGroups(groupIds);
    var groupGr = new GlideRecord("sys_user_group");
    var childGroups = [];
    groupGr.addQuery("parent", "IN", groupIds);
    groupGr.query();
    while (groupGr.next()) {
      childGroups.push(groupGr.getUniqueValue());
    }
    if (childGroups.length < 1) {
      return users.concat(allKnownUsers);
    }
    return this.getUsersForGroupHierarchy(
      childGroups,
      users.concat(allKnownUsers)
    );
  },

  getUsersForLocations: function (locationIds, totalUsers) {
    var query = "active=true^location.sys_idIN" + locationIds;
    var users = this.getUsers("sys_user", query, "sys_id");
    var childLocations = [];
    var locationGr = new GlideRecord("cmn_location");
    locationGr.addQuery("parent", "IN", locationIds);
    locationGr.query();
    while (locationGr.next()) {
      childLocations.push(locationGr.getUniqueValue());
    }
    if (childLocations.length < 1) {
      return users.concat(totalUsers);
    }
    return this.getUsersForLocations(childLocations, users.concat(totalUsers));
  },

  getUsersForDepartments: function (departmentIds, totalUsers) {
    var query = "active=true^department.sys_idIN" + departmentIds;
    var users = this.getUsers("sys_user", query, "sys_id");
    var childDepartments = [];
    var departmentGr = new GlideRecord("cmn_department");
    departmentGr.addQuery("parent", "IN", departmentIds);
    departmentGr.query();
    while (departmentGr.next()) {
      childDepartments.push(departmentGr.getUniqueValue());
    }
    if (childDepartments.length < 1) {
      return users.concat(totalUsers);
    }
    return this.getUsersForDepartments(
      childDepartments,
      users.concat(totalUsers)
    );
  },

  getUsersForCompanies: function (companyIds, totalUsers) {
    var query = "active=true^company.sys_idIN" + companyIds;
    var users = this.getUsers("sys_user", query, "sys_id");
    var childCompanies = [];
    var companyGr = new GlideRecord("core_company");
    companyGr.addQuery("parent", "IN", companyIds);
    companyGr.query();
    while (companyGr.next()) {
      childCompanies.push(companyGr.getUniqueValue());
    }
    if (childCompanies.length < 1) {
      return users.concat(totalUsers);
    }
    return this.getUsersForCompanies(childCompanies, users.concat(totalUsers));
  },

  getUsersForRoles: function (roleIds) {
    var query = "user.active=true^roleIN" + roleIds;
    return this.getUsers("sys_user_has_role", query, "user");
  },
 
  getAudienceUsers: function (swaGr) {
    var users = [];
    var table = "";
    var query = "";
    var userCollection = {};
    var resultAtrribute = "";
    if (swaGr.users) {
      table = "sys_user";
      query = "active=true^sys_idIN" + swaGr.users.toString();
      resultAtrribute = "sys_id";
      userCollection.users = this.getUsers(table, query, resultAtrribute);
      users = userCollection.users;
    }
    if (swaGr.locations) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.locations.toString(),
        []
      );
      users = users.concat(userCollection.locations);
    }
    if (swaGr.departments) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.departments.toString(),
        []
      );
      users = users.concat(userCollection.departments);
    }
    if (swaGr.groups) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.groups.toString(),
        []
      );
      users = users.concat(userCollection.groups);
    }
    if (swaGr.companies) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.companies.toString(),
        []
      );
      users = users.concat(userCollection.companies);
    }
    if (swaGr.companies) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.companies.toString(),
        []
      );
      users = users.concat(userCollection.companies);
    }
    if (swaGr.roles) {
      userCollection.locations = this.getUsersForLocations(
        swaGr.roles.toString(),
        []
      );
      users = users.concat(userCollection.roles);
    }
    if (swaGr.condition) {
      var columnName = "";
      table = swaGr.table.toString();
      if (swaGr.select_column) {
        columnName = swaGr.select_column.toString();
      }
      query = swaGr.condition.toString();
      if (table === "sys_user") {
        resultAtrribute = "sys_id";
      } else {
        resultAtrribute = columnName;
      }
      userCollection.conditions = this.getUsers(table, query, resultAtrribute);
      users = users.concat(userCollection.conditions);
    }
    if (swaGr.audience_criteria == "all_criteria") {
      var matchAllParams = [];
      var keys = Object.keys(userCollection);
      for (var index = 0; index < keys.length; index++) {
        var collection = userCollection[keys[index]];
        matchAllParams.push(collection);
      }
      var util = new global.ArrayUtil();
      return new global.ArrayUtil().intersect.apply(util, matchAllParams);
    }
    return new global.ArrayUtil().unique(users);
  },

  getAllUsers: function (audiences) {
    var users = [];
    for (var i = 0; i < audiences.length; i++) {
      var swaGr = new GlideRecord("sn_imt_core_safe_workplace_audience");
      var audienceId = audiences[i];
      swaGr.get(audienceId);
      users = users.concat(this.getAudienceUsers(swaGr));
    }
    return new global.ArrayUtil().unique(users);
  },

  getAllAudienceUsers: function (requirementGr) {
    return this.getAllUsers(requirementGr.audience.toString().split(","));
  },

  getCoreUsersForRequirement: function (requirementGr) {
    var coreUserGr = new GlideRecord("sn_imt_core_health_and_safety_user");
    var query = "type=" + requirementGr.requirement_for.toString();
    var audienceList = this.getAllAudienceUsers(requirementGr);
    if (requirementGr.exclude) {
      query += "^userNOT IN" + audienceList;
    } else if (requirementGr.audience != "") {
      query += "^userIN" + audienceList;
    }
    coreUserGr.addEncodedQuery(query);
    coreUserGr.query();
    return coreUserGr;
  },

  isUserExcludedForRequirement: function (requirement, user) {
    var requirementGr = this._getRequirementGr(requirement);
    var users = this.getCoreUsersForRequirement(requirementGr);
    while (users.next()) {
      if (users.user == user) {
        return false;
      }
    }
    return true;
  },

  _getRequirementGr: function (requirement) {
    var requirementGr = new GlideRecord(
      "sn_imt_core_health_and_safety_requirement"
    );
    requirementGr.get(requirement);
    return requirementGr;
  },

  _getCoreUser: function (user) {
    var coreUserGr = new GlideRecord("sn_imt_core_health_and_safety_user");
    coreUserGr.get(user);
    return coreUserGr;
  },

  userIsInAudience: function (audience, userId, include) {
    var swaGr = new GlideRecord("sn_imt_core_safe_workplace_audience");
    swaGr.get(audience);
    var table = "";
    var query = "";
    var resultAtrribute = "";

    if (
      !swaGr.users &&
      !swaGr.locations &&
      !swaGr.departments &&
      !swaGr.groups &&
      !swaGr.companies &&
      !swaGr.roles &&
      !swaGr.condition
    ) {
      return false;
    }

    var allFieldsEmpty = true;

    if (include.users && swaGr.users) {
      allFieldsEmpty = false;
      table = "sys_user";
      query =
        "active=true^sys_idIN" + swaGr.users.toString() + "^sys_id=" + userId;
      resultAtrribute = "sys_id";
      if (this.getUsers(table, query, resultAtrribute).indexOf(userId) >= 0) {
        return true;
      }
    }
    if (include.locations && swaGr.locations) {
      allFieldsEmpty = false;
      if (
        this.getUsersForLocations(swaGr.locations.toString(), []).indexOf(
          userId
        ) >= 0
      ) {
        return true;
      }
    }

    if (include.departments && swaGr.departments) {
      allFieldsEmpty = false;
      if (
        this.getUsersForDepartments(swaGr.departments.toString(), []).indexOf(
          userId
        ) >= 0
      ) {
        return true;
      }
    }
    if (include.groups && swaGr.groups) {
      allFieldsEmpty = false;
      if (
        this.getUsersForGroups(swaGr.groups.toString(), []).indexOf(userId) >= 0
      ) {
        return true;
      }
    }
    if (include.companies && swaGr.companies) {
      allFieldsEmpty = false;
      if (
        this.getUsersForCompanies(swaGr.companies.toString(), []).indexOf(
          userId
        ) >= 0
      ) {
        return true;
      }
    }

    if (include.roles && swaGr.roles) {
      allFieldsEmpty = false;
      if (
        this.getUsersForRoles(swaGr.roles.toString(), []).indexOf(userId) >= 0
      ) {
        return true;
      }
    }

    if (include.condition && swaGr.condition) {
      allFieldsEmpty = false;
      var columnName = "";
      table = swaGr.table.toString();
      if (swaGr.select_column) {
        columnName = swaGr.select_column.toString();
      }
      query = swaGr.condition.toString();
      if (table === "sys_user") {
        resultAtrribute = "sys_id";
      } else {
        resultAtrribute = columnName;
      }
      if (this.getUsers(table, query, resultAtrribute).indexOf(userId) >= 0) {
        return true;
      }
    }

    return allFieldsEmpty;
  },

  _userAdded: function (requirementGr, audienceGr, userGr) {
    gs.debug(
      "=== User " +
        userGr.getDisplayValue() +
        " was added to audience " +
        audienceGr.getDisplayValue()
    );
    this._userModified(requirementGr, audienceGr, userGr);
  },

  _userRemoved: function (requirementGr, audienceGr, userGr) {
    gs.debug(
      "=== User " +
        userGr.getDisplayValue() +
        " was removed from audience " +
        audienceGr.getDisplayValue()
    );
    this._userModified(requirementGr, audienceGr, userGr);
  },

  _userModified: function (requirementGr, audienceGr, userGr) {
    var healthAndSafetyUserUtil = new HealthAndSafetyUserUtil();
    var coreUserId = healthAndSafetyUserUtil.findOrCreateCoreUser({
      user: userGr,
    });
    var coreUserGr = new GlideRecord("sn_imt_core_health_and_safety_user");
    coreUserGr.get(coreUserId);
    healthAndSafetyUserUtil.createRequirementsForCoreUser(
      requirementGr,
      coreUserGr,
      { resetToDefaultStatus: true }
    );
  },

  recalculateAudiencesForRequirements: function () {
    var that = this;
    var healthAndSafetyUserUtil = new HealthAndSafetyUserUtil();
    var requirementGr = new GlideRecord(
      "sn_imt_core_health_and_safety_requirement"
    );
    requirementGr.addActiveQuery();
    requirementGr.addNotNullQuery("audience");
    requirementGr.query();

    while (requirementGr.next()) {
      gs.debug("Loaded requirement " + requirementGr.getDisplayValue());

      var modifiedUserIds = [];

      requirementGr
        .getValue("audience")
        .split(",")
        .forEach(function (audienceId) {
          var audienceGr = new GlideRecord(
            "sn_imt_core_safe_workplace_audience"
          );
          audienceGr.get(audienceId);
          gs.debug("Loaded audience " + audienceGr.getDisplayValue());
          if (audienceGr.active) {
            gs.debug(
              "Calculating users for audience",
              requirementGr.audience.getDisplayValue()
            );
            var userIds = that.getAudienceUsers(audienceGr);
            gs.debug("audience = " + userIds);

            // Reset all cached users to inactive
            var cachedUserGr = new GlideRecord(
              "sn_imt_core_safe_workplace_audience_cached_user"
            );
            cachedUserGr.addQuery("safe_workplace_audience", audienceId);
            cachedUserGr.setValue("active", false);
            cachedUserGr.updateMultiple();

            userIds.forEach(function (userId) {
              gs.debug("checking user " + userId);
              var cachedUserGr = new GlideRecord(
                "sn_imt_core_safe_workplace_audience_cached_user"
              );
              cachedUserGr.addQuery("safe_workplace_audience", audienceId);
              cachedUserGr.addQuery("user", userId);
              cachedUserGr.query();
              var userGr = new GlideRecord("sys_user");
              userGr.get(userId);
              if (cachedUserGr.next()) {
                gs.debug(
                  "User " +
                    userGr.getDisplayValue() +
                    " is already in audience " +
                    audienceGr.getDisplayValue()
                );

                cachedUserGr.setValue("active", true);
                cachedUserGr.update();
              } else {
                that._userAdded(requirementGr, audienceGr, userGr);
                modifiedUserIds.push(userId);

                var newCachedUserGr = new GlideRecord(
                  "sn_imt_core_safe_workplace_audience_cached_user"
                );
                newCachedUserGr.setValue("user", userId);
                newCachedUserGr.setValue("safe_workplace_audience", audienceId);
                newCachedUserGr.setValue("active", true);
                newCachedUserGr.insert();
              }
            });

            cachedUserGr = new GlideRecord(
              "sn_imt_core_safe_workplace_audience_cached_user"
            );
            cachedUserGr.addQuery("safe_workplace_audience", audienceId);
            cachedUserGr.addQuery("active", false);
            cachedUserGr.query();
            while (cachedUserGr.next()) {
              that._userRemoved(
                requirementGr,
                audienceGr,
                cachedUserGr.user.getRefRecord()
              );
              modifiedUserIds.push(cachedUserGr.getValue("user"));

              cachedUserGr.deleteRecord();
            }
          }
        });
      healthAndSafetyUserUtil.invokeRequirementFlow(
        requirementGr,
        modifiedUserIds
      );
    }
  },

  type: "SafeWorkplaceAudienceUtil",
};
