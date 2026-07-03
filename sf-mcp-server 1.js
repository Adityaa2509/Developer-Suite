import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import jsforce from "jsforce";
import NodeCache from "node-cache";
import "dotenv/config";

const sfCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ─────────────────────────────────────────────────────────────
// HELPER: Parse SOQL Query
// ─────────────────────────────────────────────────────────────

function parseSOQLQuery(query) {
  try {
    if (!query || typeof query !== "string") {
      return { success: false, error: "Query must be a non-empty string" };
    }

    const trimmed = query.trim();

    const selectMatch = trimmed.match(/SELECT\s+([\s\S]*?)\s+FROM\s+([A-Za-z_]\w*)/i);
    if (!selectMatch) {
      return { success: false, error: "Could not find SELECT...FROM clause" };
    }

    const fieldsString = selectMatch[1].trim();
    const objectType   = selectMatch[2].trim();

    const fields = fieldsString
      .split(",")
      .map(f => {
        const t            = f.trim();
        const withoutAlias = t.split(/\s+AS\s+/i)[0].trim();
        return /^[A-Za-z_]\w*$/.test(withoutAlias) ? withoutAlias : null;
      })
      .filter(f => f && f.length > 0);

    if (fields.length === 0) {
      return { success: false, error: "No queryable fields found in SELECT clause" };
    }

    return { success: true, objectType, selectedFields: fields };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────
// HELPER: Build Clean Query
// ─────────────────────────────────────────────────────────────

function buildCleanQuery(originalQuery, accessibleFields, objectType) {
  if (accessibleFields.length === 0) return null;
  try {
    const whereMatch = originalQuery.match(/WHERE\s+([\s\S]*?)(?:ORDER|LIMIT|$)/i);
    const orderMatch = originalQuery.match(/ORDER\s+BY\s+([\s\S]*?)(?:LIMIT|$)/i);
    const limitMatch = originalQuery.match(/LIMIT\s+(\d+)/i);

    let cleanQuery = `SELECT ${accessibleFields.join(", ")} FROM ${objectType}`;
    if (whereMatch?.[1]) cleanQuery += ` WHERE ${whereMatch[1].trim()}`;
    if (orderMatch?.[1]) cleanQuery += ` ORDER BY ${orderMatch[1].trim()}`;
    if (limitMatch)      cleanQuery += ` LIMIT ${limitMatch[1]}`;
    return cleanQuery;
  } catch (e) {
    console.error(`[MCP] buildCleanQuery failed: ${e.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function escapeSOQL(value) {
  if (value === null || value === undefined) throw new Error("escapeSOQL: value is null or undefined");
  const str = String(value).trim();
  if (str.length === 0) throw new Error("escapeSOQL: value is empty after trim");
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// FIX: Safe share table name — never escape, only sanitize
function getShareTableName(objectType) {
  if (!objectType || typeof objectType !== "string") {
    throw new Error("objectType must be a non-empty string");
  }
  // FIX: Sanitize to prevent injection — only allow alphanumeric + underscore
  const safe = objectType.replace(/[^A-Za-z0-9_]/g, "");
  return safe.endsWith("__c")
    ? `${safe.slice(0, -3)}__Share`
    : `${safe}Share`;
}

// ─────────────────────────────────────────────────────────────
// CONNECTION MANAGER
// ─────────────────────────────────────────────────────────────

let _conn        = null;
let _reconnecting = null;

async function getConn() {
  if (_reconnecting) return _reconnecting;

  if (_conn) {
    try {
      await _conn.identity();
      return _conn;
    } catch {
      console.error("[MCP] Session expired. Auto-reconnecting...");
      _conn = null;
    }
  }

  _reconnecting = new Promise(async (resolve, reject) => {
    try {
      const conn = new jsforce.Connection({
        loginUrl: process.env.SF_LOGIN_URL || "https://login.salesforce.com",
        version:  "60.0",
      });
      if (!process.env.SF_USERNAME || !process.env.SF_PASSWORD) {
        throw new Error("SF_USERNAME and SF_PASSWORD env vars required");
      }
      const loginPassword = process.env.SF_SECURITY_TOKEN 
        ? process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN 
        : process.env.SF_PASSWORD;
      await conn.login(process.env.SF_USERNAME, loginPassword);
      console.error(`[MCP] Connected as ${process.env.SF_USERNAME}`);
      _conn         = conn;
      _reconnecting = null;
      resolve(conn);
    } catch (e) {
      console.error(`[MCP] Connection failed: ${e.message}`);
      _reconnecting = null;
      reject(e);
    }
  });

  return _reconnecting;
}

// ─────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────

async function getUserPermSetIds(conn, userId) {
  try {
    const uid      = escapeSOQL(userId);
    const cacheKey = `permsets_${uid.slice(-10)}`;
    if (sfCache.has(cacheKey)) return sfCache.get(cacheKey);

    const assignments = await conn.query(`
      SELECT PermissionSetId,
             PermissionSet.IsOwnedByProfile,
             PermissionSet.PermissionSetGroupId
      FROM   PermissionSetAssignment
      WHERE  AssigneeId = '${uid}'
    `);

    const allIds      = assignments.records.map(r => r.PermissionSetId);
    const profilePsId = assignments.records.find(r => r.PermissionSet?.IsOwnedByProfile)?.PermissionSetId ?? null;
    const groupIds    = assignments.records
      .filter(r => r.PermissionSet?.PermissionSetGroupId)
      .map(r => r.PermissionSet.PermissionSetGroupId);

    let mutingIds = [];
    if (groupIds.length) {
      const escaped = groupIds.map(id => `'${escapeSOQL(id)}'`).join(",");
      const muting  = await conn.query(`
        SELECT Id FROM MutingPermissionSet
        WHERE  PermissionSetGroupId IN (${escaped})
      `);
      mutingIds = muting.records.map(r => r.Id);
    }

    const result = { allIds, profilePsId, groupIds, mutingIds };
    sfCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.error(`[MCP] getUserPermSetIds failed: ${e.message}`);
    throw e;
  }
}

async function expandGroupIds(conn, seedIds) {
  try {
    if (!seedIds || seedIds.length === 0) return [];

    const sortedIds = [...seedIds].sort();
    const keyHash   = sortedIds.join("_").slice(0, 60);
    const cacheKey  = `groups_${keyHash}`;
    if (sfCache.has(cacheKey)) return sfCache.get(cacheKey);

    const visited  = new Set(seedIds);
    let   frontier = [...seedIds];

    while (frontier.length) {
      const escaped = frontier.map(id => `'${escapeSOQL(id)}'`).join(",");
      const parents = await conn.query(`
        SELECT GroupId FROM GroupMember
        WHERE  UserOrGroupId IN (${escaped})
      `);
      frontier = [];
      for (const { GroupId } of parents.records) {
        if (!visited.has(GroupId)) {
          visited.add(GroupId);
          frontier.push(GroupId);
        }
      }
    }

    const result = [...visited];
    sfCache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.error(`[MCP] expandGroupIds failed: ${e.message}`);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// MCP SERVER
// ─────────────────────────────────────────────────────────────

const server = new McpServer({ name: "sf-permissions-advanced", version: "4.2.0" });

// ─────────────────────────────────────────────────────────────
// TOOL 1: User Identity
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_user_identity",
  "Resolve user identity, profile, role, user type, and system-wide permission flags such as ViewAll and ModifyAll",
  { username: z.string().describe("Username, email, or full name") },
  async ({ username }) => {
    try {
      if (!username || typeof username !== "string") {
        return { content: [{ type: "text", text: JSON.stringify({ error: "username must be a non-empty string" }) }] };
      }

      const conn = await getConn();
      const u    = escapeSOQL(username);

      const result = await conn.query(`
        SELECT Id, Username, Name, Email, IsActive,
               ProfileId, Profile.Name,
               UserRoleId, UserRole.Name,
               UserType, ManagerId, Manager.Name, Manager.Username
        FROM   User
        WHERE  Username = '${u}' OR Name = '${u}' OR Email = '${u}'
        LIMIT  1
      `);

      if (!result.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "User not found", username }) }] };
      }

      const user = result.records[0];

      const psQuery = await conn.query(`
        SELECT PermissionSet.Name,
               PermissionSet.IsOwnedByProfile,
               PermissionSet.PermissionsViewAllData,
               PermissionSet.PermissionsModifyAllData,
               PermissionSet.PermissionsApiEnabled,
               PermissionSet.PermissionsManageUsers
        FROM   PermissionSetAssignment
        WHERE  AssigneeId = '${user.Id}'
      `);

      const assignedPermSets = psQuery.records
        .filter(r => !r.PermissionSet?.IsOwnedByProfile)
        .map(r => r.PermissionSet.Name);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            userId:      user.Id,
            username:    user.Username,
            fullName:    user.Name,
            email:       user.Email,
            isActive:    user.IsActive,
            profileId:   user.ProfileId,
            profileName: user.Profile?.Name,
            roleId:      user.UserRoleId ?? null,
            roleName:    user.UserRole?.Name ?? null,
            // FIX: Include manager info for role hierarchy context
            managerId:   user.ManagerId ?? null,
            managerName: user.Manager?.Name ?? null,
            managerUsername: user.Manager?.Username ?? null,
            userType:    user.UserType,
            systemFlags: {
              viewAll:     psQuery.records.some(r => r.PermissionSet?.PermissionsViewAllData),
              modifyAll:   psQuery.records.some(r => r.PermissionSet?.PermissionsModifyAllData),
              apiEnabled:  psQuery.records.some(r => r.PermissionSet?.PermissionsApiEnabled),
              manageUsers: psQuery.records.some(r => r.PermissionSet?.PermissionsManageUsers),
            },
            assignedPermissionSets: assignedPermSets,
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_user_identity: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 2: Object Permissions
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_object_permissions",
  "Evaluate cumulative object CRUD permissions (Create, Read, Edit, Delete) plus system-wide ViewAll and ModifyAll overrides for a specific user",
  {
    userId:     z.string().describe("Salesforce User ID (18-char)"),
    objectType: z.string().describe("Object API name e.g. Account, Custom_Object__c"),
  },
  async ({ userId, objectType }) => {
    try {
      if (!userId || !objectType) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "userId and objectType are required" }) }] };
      }

      const conn       = await getConn();
      const obj        = escapeSOQL(objectType);
      const { allIds } = await getUserPermSetIds(conn, userId);

      if (!allIds.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No permission sets found for user" }) }] };
      }

      const permResult = await conn.query(`
        SELECT SobjectType,
               PermissionsCreate, PermissionsRead,
               PermissionsEdit,   PermissionsDelete,
               PermissionsViewAllRecords, PermissionsModifyAllRecords,
               ParentId,
               Parent.Name,
               Parent.Label,
               Parent.IsOwnedByProfile,
               Parent.Profile.Name
        FROM   ObjectPermissions
        WHERE  SobjectType = '${obj}'
        AND    ParentId IN ('${allIds.join("','")}')
      `);

      const perms = { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false };
      for (const r of permResult.records) {
        if (r.PermissionsCreate)           perms.create    = true;
        if (r.PermissionsRead)             perms.read      = true;
        if (r.PermissionsEdit)             perms.edit      = true;
        if (r.PermissionsDelete)           perms.delete    = true;
        if (r.PermissionsViewAllRecords)   perms.viewAll   = true;
        if (r.PermissionsModifyAllRecords) perms.modifyAll = true;
      }

      const grantingPermSets = permResult.records
        .filter(r =>
          r.PermissionsCreate || r.PermissionsRead ||
          r.PermissionsEdit   || r.PermissionsDelete ||
          r.PermissionsViewAllRecords || r.PermissionsModifyAllRecords
        )
        .map(r => {
          const isProfile = r.Parent?.IsOwnedByProfile ?? false;
          const grants    = [];
          if (r.PermissionsCreate)           grants.push("Create");
          if (r.PermissionsRead)             grants.push("Read");
          if (r.PermissionsEdit)             grants.push("Edit");
          if (r.PermissionsDelete)           grants.push("Delete");
          if (r.PermissionsViewAllRecords)   grants.push("ViewAll");
          if (r.PermissionsModifyAllRecords) grants.push("ModifyAll");
          return {
            id:          r.ParentId,
            name:        r.Parent?.Name        ?? r.ParentId,
            label:       r.Parent?.Label       ?? r.ParentId,
            isProfile,
            profileName: isProfile ? (r.Parent?.Profile?.Name ?? null) : null,
            grants,
          };
        });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType:           obj,
            userId,
            permSetsEvaluated:    allIds.length,
            effectivePermissions: perms,
            grantingPermSets,
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_object_permissions: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 31: Analyze SOQL Query for FLS Issues
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_analyze_soql_query",
  "Analyze a SOQL query to identify field-level security restrictions. Returns a detailed report showing which fields are accessible and which are blocked, with remediation steps.",
  {
    userId:    z.string().describe("Salesforce User ID"),
    soqlQuery: z.string().describe("SOQL query e.g. SELECT Id, Name, AnnualRevenue FROM Account"),
  },
  async ({ userId, soqlQuery }) => {
    try {
      if (!userId || !soqlQuery) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "userId and soqlQuery are required" }) }] };
      }

      const conn = await getConn();
      const uid  = escapeSOQL(userId);

      const parseResult = parseSOQLQuery(soqlQuery);
      if (!parseResult.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error:  "Could not parse SOQL query",
              reason: parseResult.error,
              hint:   "Ensure query format is: SELECT field1, field2 FROM ObjectType WHERE ...",
            }),
          }],
        };
      }

      const { objectType, selectedFields } = parseResult;
      const obj = escapeSOQL(objectType);

      const { allIds } = await getUserPermSetIds(conn, uid);
      if (!allIds.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No permission sets found for user", userId }) }] };
      }

      const flsQuery = selectedFields
        .filter(f => f.toLowerCase() !== "id")
        .map(f => `'${obj}.${f}'`)
        .join(",");

      let flsData = {};
      if (flsQuery) {
        const flsResult = await conn.query(`
          SELECT Field, PermissionsRead, PermissionsEdit, ParentId
          FROM   FieldPermissions
          WHERE  Field IN (${flsQuery})
          AND    ParentId IN ('${allIds.join("','")}')
        `);

        for (const r of flsResult.records) {
          const fieldName = r.Field.split(".")[1];
          if (!flsData[fieldName]) flsData[fieldName] = { read: false, edit: false };
          if (r.PermissionsRead) flsData[fieldName].read = true;
          if (r.PermissionsEdit) flsData[fieldName].edit = true;
        }
      }

      const sysRes = await conn.query(`
        SELECT PermissionsViewAllData, PermissionsModifyAllData
        FROM   PermissionSet WHERE Id IN ('${allIds.join("','")}')
      `);
      const hasViewAll   = sysRes.records.some(r => r.PermissionsViewAllData);
      const hasModifyAll = sysRes.records.some(r => r.PermissionsModifyAllData);

      const fieldAnalysis    = [];
      const accessibleFields = [];
      const blockedFields    = [];

      for (const field of selectedFields) {
        const isIdField = field.toLowerCase() === "id";
        const hasAccess = isIdField || flsData[field]?.read || hasViewAll;
        const canEdit   = flsData[field]?.edit || hasModifyAll;

        const entry = {
          fieldName:     field,
          hasReadAccess: hasAccess,
          hasEditAccess: canEdit,
          accessVia: isIdField
            ? "System Field (always readable)"
            : hasViewAll
            ? "System Override (ViewAllData)"
            : flsData[field]?.read
            ? "Explicit FLS Grant"
            : "NO ACCESS ❌",
          error: hasAccess ? null : `User does not have Read permission on ${obj}.${field}`,
        };

        fieldAnalysis.push(entry);
        if (hasAccess) accessibleFields.push(field);
        else           blockedFields.push(field);
      }

      const cleanQuery = buildCleanQuery(soqlQuery, accessibleFields, objectType);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            userId,
            originalQuery:         soqlQuery,
            objectType:            obj,
            totalFieldsInQuery:    selectedFields.length,
            accessibleFieldsCount: accessibleFields.length,
            blockedFieldsCount:    blockedFields.length,
            systemOverrides:       { viewAllData: hasViewAll, modifyAllData: hasModifyAll },
            fieldAnalysis: fieldAnalysis.map(f => ({
              fieldName:   f.fieldName,
              status:      f.error ? "🔒 BLOCKED" : "✅ OK",
              readAccess:  f.hasReadAccess,
              editAccess:  f.hasEditAccess,
              grantedVia:  f.accessVia,
              errorReason: f.error,
            })),
            blockedFieldsDetail: blockedFields.length > 0
              ? blockedFields.map(field => ({
                  fieldName:     field,
                  qualifiedName: `${obj}.${field}`,
                  error:         `FLS Restriction: User does not have Read permission on this field`,
                  resolution:    `Grant PermissionSet with FieldPermissions.PermissionsRead=true for ${obj}.${field}`,
                }))
              : [],
            queryRecommendation: {
              status:        blockedFields.length === 0 ? "✅ QUERY SAFE" : "🚨 QUERY WILL FAIL",
              message:       blockedFields.length === 0
                ? "All fields in the query are accessible to this user"
                : `${blockedFields.length} field(s) blocked. Query will fail with INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY or similar`,
              cleanQuery:    blockedFields.length > 0 ? cleanQuery : null,
              cleanQueryNote: blockedFields.length > 0
                ? `This query includes only accessible fields. Original query would error on: ${blockedFields.join(", ")}`
                : null,
            },
            summary: {
              canQueryAsIs:      blockedFields.length === 0,
              actionNeeded:      blockedFields.length > 0,
              recommendedAction: blockedFields.length > 0
                ? `Remove these fields or grant FLS access: ${blockedFields.join(", ")}`
                : "Query is ready to execute",
            },
          }, null, 2),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_analyze_soql_query: ${e.message}`);
      return {
        isError: true,
        content: [{
          type: "text",
          text: JSON.stringify({ status: "error", reason: e.message, hint: "Ensure user exists and query is valid SOQL syntax" }),
        }],
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 3: Record Owner & OWD
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_record_owner",
  "Determine record ownership, Org-Wide Default (OWD) sharing model, and recycle bin status to assess access baseline",
  {
    objectType: z.string().describe("Object API name"),
    recordId:   z.string().describe("15 or 18 character Salesforce Record ID"),
  },
  async ({ objectType, recordId }) => {
    if (!recordId || recordId === "undefined" || recordId.length < 15) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "Invalid or missing Record ID.",
            hint:  "You must supply a valid 15 or 18-character Salesforce Record ID.",
          }),
        }],
      };
    }
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);
      const rid  = escapeSOQL(recordId);

      let record = null;
      try {
        const recResult = await conn.queryAll(`
          SELECT Id, OwnerId, IsDeleted, CreatedById, LastModifiedById
          FROM   ${obj} WHERE Id = '${rid}'
        `);
        if (!recResult.records.length) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                recordId: rid, objectType: obj,
                warning:  "Record not found via queryAll. May be hard-deleted, wrong objectType, or integration user lacks visibility.",
              }),
            }],
          };
        }
        record = recResult.records[0];
      } catch (e) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              recordId: rid, objectType: obj,
              warning:  `Query failed for ${obj}: ${e.message}.`,
            }),
          }],
        };
      }

      const ownerType = record.OwnerId?.startsWith("00G") ? "Queue" : "User";

      if (record.IsDeleted) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              recordId:              record.Id,
              ownerId:               record.OwnerId,
              ownerType,
              isDeletedInRecycleBin: true,
              warning:               "CRITICAL: Record is in the Recycle Bin.",
            }),
          }],
        };
      }

      let owd = null;
      try {
        const owdResult = await conn.tooling.query(`
          SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel
          FROM   EntityDefinition WHERE QualifiedApiName = '${obj}'
        `);
        owd = owdResult.records[0] ?? null;
      } catch (e) {
        console.error("[MCP] OWD Tooling query failed:", e.message);
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            recordId:              record.Id,
            ownerId:               record.OwnerId,
            ownerType,
            isDeletedInRecycleBin: false,
            internalSharingModel:  owd?.InternalSharingModel ?? "Unknown",
            externalSharingModel:  owd?.ExternalSharingModel ?? "Unknown",
            warning:               null,
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_record_owner: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 4: Sharing Rules
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_sharing_rules",
  "Deep-scan the share table with recursive public group expansion to identify all explicit share rows for a user.",
  {
    objectType: z.string().describe("Object type e.g. Account"),
    recordId:   z.string(),
    userId:     z.string(),
  },
  async ({ objectType, recordId, userId }) => {
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);
      const rid  = escapeSOQL(recordId);
      const uid  = escapeSOQL(userId);

      const shareTable = getShareTableName(obj);

      let shares = [];
      try {
        const s = await conn.query(`
          SELECT Id, UserOrGroupId, AccessLevel, RowCause
          FROM   ${shareTable} WHERE ParentId = '${rid}'
        `);
        shares = s.records;
      } catch (e) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error:      `Cannot query ${shareTable}: ${e.message}`,
              shareTable,
              hint:       "Object may have sharing disabled or Share object name is different.",
            }),
          }],
        };
      }

      let matchingShares = [];
      let allGroupIds    = [uid];

      if (shares.length > 0) {
        const directGroups   = await conn.query(`SELECT GroupId FROM GroupMember WHERE UserOrGroupId = '${uid}'`);
        const directGroupIds = directGroups.records.map(r => r.GroupId);
        allGroupIds          = await expandGroupIds(conn, [uid, ...directGroupIds]);
        matchingShares       = shares.filter(s => allGroupIds.includes(s.UserOrGroupId));
      }

      const accessRank    = { Read: 1, Edit: 2, All: 3 };
      const highestAccess = matchingShares.reduce(
        (best, cur) => (accessRank[cur.AccessLevel] ?? 0) > (accessRank[best] ?? 0) ? cur.AccessLevel : best,
        "None"
      );

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            shareTable,
            totalShareRowsOnRecord:   shares.length,
            userAndGroupIdsEvaluated: allGroupIds.length,
            roleHierarchyEvaluated:   false,
            roleHierarchyNote:        "Role hierarchy implicit grants are NOT in these results. Call sf_get_role_hierarchy separately.",
            matchingShareRows:        matchingShares.map(s => ({
              rowCause:    s.RowCause,
              accessLevel: s.AccessLevel,
              grantedToId: s.UserOrGroupId,
            })),
            highestGrantedAccess: highestAccess,
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_sharing_rules: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 5: Field-Level Security
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_field_security",
  "Check if a user has Read and Edit access to a specific field across all assigned permission sets",
  {
    userId:     z.string().describe("Salesforce User ID (18-char)"),
    objectType: z.string().describe("Object API name e.g. Account"),
    fieldName:  z.string().describe("Field API Name without object prefix e.g. AnnualRevenue"),
  },
  async ({ userId, objectType, fieldName }) => {
    if (!userId || !objectType || !fieldName) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "Missing required tool arguments. Ensure userId, objectType, and fieldName are provided." }),
        }],
      };
    }

    try {
      const conn            = await getConn();
      const obj             = escapeSOQL(objectType);
      const field           = escapeSOQL(fieldName);
      const { allIds }      = await getUserPermSetIds(conn, userId);

      if (!allIds.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No permission sets found for user" }) }] };
      }

      const qualifiedField = `${obj}.${field}`;
      const flsResult      = await conn.query(`
        SELECT Field, PermissionsRead, PermissionsEdit, ParentId
        FROM   FieldPermissions
        WHERE  Field = '${qualifiedField}'
        AND    ParentId IN ('${allIds.join("','")}')
      `);

      const fls = { read: false, edit: false };
      for (const r of flsResult.records) {
        if (r.PermissionsRead) fls.read = true;
        if (r.PermissionsEdit) fls.edit = true;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            field:             qualifiedField,
            userId,
            permSetsEvaluated: allIds.length,
            effectiveFLS:      fls,
            status:            !fls.read
              ? "Hidden (no read permission granted by any PermissionSet)"
              : fls.edit ? "Readable + Editable" : "Read-Only",
            grantingPermSets:  flsResult.records
              .filter(r => r.PermissionsRead || r.PermissionsEdit)
              .map(r => ({ id: r.ParentId, read: r.PermissionsRead, edit: r.PermissionsEdit })),
          }),
        }],
      };
    } catch (e) {
      console.error(`[MCP Tool Error] sf_get_field_security: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 6: Profile Base Permissions
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_profile_permissions",
  "Retrieve object CRUD and system permissions granted directly by a user's assigned Profile",
  {
    userId:     z.string().describe("Salesforce User ID"),
    objectType: z.string().optional().describe("Optional: filter to one object API name"),
  },
  async ({ userId, objectType }) => {
    try {
      const conn            = await getConn();
      const uid             = escapeSOQL(userId);
      const { profilePsId } = await getUserPermSetIds(conn, uid);

      if (!profilePsId) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Could not determine Profile-backed PermissionSet for user" }) }] };
      }

      const objFilter = objectType ? `AND SobjectType = '${escapeSOQL(objectType)}'` : "";

      const objPerms  = await conn.query(`
        SELECT SobjectType,
               PermissionsCreate, PermissionsRead,
               PermissionsEdit,   PermissionsDelete,
               PermissionsViewAllRecords, PermissionsModifyAllRecords
        FROM   ObjectPermissions
        WHERE  ParentId = '${profilePsId}'
        ${objFilter}
        ORDER BY SobjectType
      `);

      const sysPerms = await conn.query(`
        SELECT PermissionsViewAllData, PermissionsModifyAllData,
               PermissionsApiEnabled, PermissionsManageUsers,
               PermissionsCustomizeApplication, PermissionsAuthorApex
        FROM   PermissionSet WHERE Id = '${profilePsId}'
      `);

      const sys = sysPerms.records[0] ?? {};

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            profilePermSetId: profilePsId,
            systemPermissions: {
              viewAllData:          sys.PermissionsViewAllData          ?? false,
              modifyAllData:        sys.PermissionsModifyAllData        ?? false,
              apiEnabled:           sys.PermissionsApiEnabled           ?? false,
              manageUsers:          sys.PermissionsManageUsers          ?? false,
              customizeApplication: sys.PermissionsCustomizeApplication ?? false,
              authorApex:           sys.PermissionsAuthorApex           ?? false,
            },
            objectPermissions: objPerms.records.map(r => ({
              object:    r.SobjectType,
              create:    r.PermissionsCreate,
              read:      r.PermissionsRead,
              edit:      r.PermissionsEdit,
              delete:    r.PermissionsDelete,
              viewAll:   r.PermissionsViewAllRecords,
              modifyAll: r.PermissionsModifyAllRecords,
            })),
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_profile_permissions: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 7: System Permissions
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_system_permissions",
  "Aggregate all system-level permission flags across a user's Profile and all assigned permission sets",
  { userId: z.string().describe("Salesforce User ID") },
  async ({ userId }) => {
    try {
      const conn       = await getConn();
      const { allIds } = await getUserPermSetIds(conn, userId);

      if (!allIds.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No PermSets found" }) }] };
      }

      const result = await conn.query(`
        SELECT Id, Name, IsOwnedByProfile,
               PermissionsViewAllData,
               PermissionsModifyAllData,
               PermissionsApiEnabled,
               PermissionsManageUsers,
               PermissionsCustomizeApplication,
               PermissionsAuthorApex
        FROM   PermissionSet
        WHERE  Id IN ('${allIds.join("','")}')
      `);

      const net = {}, grantSources = {};
      for (const rec of result.records) {
        for (const [key, val] of Object.entries(rec)) {
          if (key.startsWith("Permissions") && typeof val === "boolean") {
            net[key] = net[key] || val;
            if (val === true) {
              grantSources[key] ??= [];
              grantSources[key].push({ id: rec.Id, name: rec.Name, isProfile: rec.IsOwnedByProfile });
            }
          }
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ userId, permSetsEvaluated: allIds.length, netSystemPermissions: net, grantedBy: grantSources }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_system_permissions: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 8: Apex Class Access
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_apex_class_access",
  "Check whether a user can access and invoke a specific Apex class via their profile or permission sets",
  {
    userId:        z.string().describe("Salesforce User ID"),
    apexClassName: z.string().describe("Apex class name e.g. MyController"),
  },
  async ({ userId, apexClassName }) => {
    try {
      const conn       = await getConn();
      const cls        = escapeSOQL(apexClassName);
      const { allIds } = await getUserPermSetIds(conn, userId);

      const clsResult = await conn.query(`SELECT Id, Name FROM ApexClass WHERE Name = '${cls}' LIMIT 1`);
      if (!clsResult.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `ApexClass '${cls}' not found` }) }] };
      }
      const apexClassId = clsResult.records[0].Id;

      const accessResult = await conn.query(`
        SELECT SetupEntityId, ParentId FROM SetupEntityAccess
        WHERE  SetupEntityId = '${apexClassId}'
        AND    ParentId IN ('${allIds.join("','")}')
      `);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            userId, apexClass: cls, apexClassId,
            hasAccess:        accessResult.records.length > 0,
            grantingPermSets: accessResult.records.map(r => r.ParentId),
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_apex_class_access: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 9: Record Type Access
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_record_type_access",
  "Enumerate all record types for an object and show which ones the user is permitted to access and create",
  {
    userId:     z.string().describe("Salesforce User ID"),
    objectType: z.string().describe("Object API name e.g. Account"),
  },
  async ({ userId, objectType }) => {
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);
      const uid  = escapeSOQL(userId);

      const userRes = await conn.query(`SELECT ProfileId FROM User WHERE Id = '${uid}' LIMIT 1`);
      if (!userRes.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }] };
      }
      const profileId = escapeSOQL(userRes.records[0].ProfileId);

      const { allIds, profilePsId } = await getUserPermSetIds(conn, uid);
      const nonProfilePsIds = allIds.filter(id => id !== profilePsId);

      const rtResult = await conn.query(`
        SELECT Id, Name, DeveloperName, IsActive FROM RecordType
        WHERE  SobjectType = '${obj}' AND IsActive = true
      `);

      if (!rtResult.records.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ objectType: obj, message: "No active Record Types found — object uses Master record type only" }),
          }],
        };
      }

      const rtIds  = rtResult.records.map(r => `'${r.Id}'`).join(",");
      const visMap = {};

      try {
        const profileVis = await conn.tooling.query(`
          SELECT RecordTypeId, IsDefault, Visible FROM ProfileRecordTypeVisibility
          WHERE  ProfileId = '${profileId}' AND RecordTypeId IN (${rtIds})
        `);
        for (const r of profileVis.records) {
          visMap[r.RecordTypeId] ??= { visible: false, isDefault: false, source: [] };
          if (r.Visible)   { visMap[r.RecordTypeId].visible = true; visMap[r.RecordTypeId].source.push("Profile"); }
          if (r.IsDefault)   visMap[r.RecordTypeId].isDefault = true;
        }
      } catch (e) {
        console.error("[MCP] ProfileRecordTypeVisibility query failed:", e.message);
      }

      if (nonProfilePsIds.length) {
        try {
          const psVis = await conn.tooling.query(`
            SELECT RecordTypeId, IsDefault, Visible, SetupOwnerId
            FROM   PermissionSetRecordTypeVisibility
            WHERE  SetupOwnerId IN ('${nonProfilePsIds.join("','")}')
            AND    RecordTypeId IN (${rtIds})
          `);
          for (const r of psVis.records) {
            visMap[r.RecordTypeId] ??= { visible: false, isDefault: false, source: [] };
            if (r.Visible)   { visMap[r.RecordTypeId].visible = true; visMap[r.RecordTypeId].source.push("PermissionSet"); }
            if (r.IsDefault)   visMap[r.RecordTypeId].isDefault = true;
          }
        } catch (e) {
          console.error("[MCP] PermissionSetRecordTypeVisibility query failed:", e.message);
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType: obj, userId, profileId,
            recordTypes: rtResult.records.map(rt => ({
              id:            rt.Id,
              name:          rt.Name,
              developerName: rt.DeveloperName,
              visible:       visMap[rt.Id]?.visible   ?? false,
              isDefault:     visMap[rt.Id]?.isDefault ?? false,
              grantedVia:    visMap[rt.Id]?.source    ?? [],
              note:          !visMap[rt.Id] ? "Not found in ProfileRecordTypeVisibility or PermissionSetRecordTypeVisibility" : null,
            })),
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_record_type_access: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 10: Login Restrictions
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_login_restrictions",
  "Retrieve login hour windows and IP address range restrictions configured on the user's profile",
  { userId: z.string().describe("Salesforce User ID") },
  async ({ userId }) => {
    try {
      const conn = await getConn();
      const uid  = escapeSOQL(userId);

      const userRes = await conn.query(`SELECT ProfileId FROM User WHERE Id = '${uid}' LIMIT 1`);
      if (!userRes.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }] };
      }
      const profileId = escapeSOQL(userRes.records[0].ProfileId);

      let loginHours = [];
      try {
        const lhRes = await conn.tooling.query(`
          SELECT DayOfWeek, TimeStart, TimeEnd FROM ProfileLoginHours WHERE ProfileId = '${profileId}'
        `);
        loginHours = lhRes.records;
      } catch (e) {
        loginHours = [{ note: "Could not query ProfileLoginHours: " + e.message }];
      }

      let ipRanges = [];
      try {
        const ipRes = await conn.tooling.query(`
          SELECT StartAddress, EndAddress, Description FROM ProfileIpRange WHERE ProfileId = '${profileId}'
        `);
        ipRanges = ipRes.records;
      } catch (e) {
        ipRanges = [{ note: "Could not query ProfileIpRange: " + e.message }];
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            userId, profileId,
            loginHours: loginHours.length
              ? loginHours.map(h => ({ day: h.DayOfWeek, start: h.TimeStart, end: h.TimeEnd }))
              : [{ note: "No login-hour restrictions — 24/7 access allowed" }],
            trustedIpRanges: ipRanges.length
              ? ipRanges.map(ip => ({ from: ip.StartAddress, to: ip.EndAddress, description: ip.Description }))
              : [{ note: "No IP range restrictions defined" }],
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_login_restrictions: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 11: Full Effective Permissions Aggregate
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_effective_permissions",
  "Single comprehensive call returning effective object CRUD, field-level security, system permissions, and record sharing access for a user",
  {
    userId:     z.string().describe("Salesforce User ID"),
    objectType: z.string().describe("Object API name"),
    recordId:   z.string().optional().describe("Optional: specific record ID for sharing analysis"),
    fieldNames: z.string().optional().describe("Optional: comma-separated field API names e.g. 'AnnualRevenue,Phone'"),
  },
  async ({ userId, objectType, recordId, fieldNames }) => {
    try {
      const fieldNamesArr = fieldNames
        ? fieldNames.split(",").map(f => f.trim()).filter(Boolean)
        : [];

      const conn       = await getConn();
      const uid        = escapeSOQL(userId);
      const obj        = escapeSOQL(objectType);
      const { allIds } = await getUserPermSetIds(conn, uid);

      const output = {
        userId, objectType: obj,
        permSetsEvaluated: allIds.length,
        roleHierarchyNote: "Role-hierarchy implicit grants are NOT evaluated here. Call sf_get_role_hierarchy.",
      };

      const objPerms = await conn.query(`
        SELECT PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
               PermissionsViewAllRecords, PermissionsModifyAllRecords
        FROM   ObjectPermissions
        WHERE  SobjectType = '${obj}' AND ParentId IN ('${allIds.join("','")}')
      `);
      output.objectCRUD = { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false };
      for (const r of objPerms.records) {
        if (r.PermissionsCreate)           output.objectCRUD.create    = true;
        if (r.PermissionsRead)             output.objectCRUD.read      = true;
        if (r.PermissionsEdit)             output.objectCRUD.edit      = true;
        if (r.PermissionsDelete)           output.objectCRUD.delete    = true;
        if (r.PermissionsViewAllRecords)   output.objectCRUD.viewAll   = true;
        if (r.PermissionsModifyAllRecords) output.objectCRUD.modifyAll = true;
      }

      const sysRes = await conn.query(`
        SELECT PermissionsViewAllData, PermissionsModifyAllData
        FROM   PermissionSet WHERE Id IN ('${allIds.join("','")}')
      `);
      output.systemOverrides = {
        viewAllData:   sysRes.records.some(r => r.PermissionsViewAllData),
        modifyAllData: sysRes.records.some(r => r.PermissionsModifyAllData),
      };
      if (output.systemOverrides.viewAllData)   output.objectCRUD.read = true;
      if (output.systemOverrides.modifyAllData) {
        output.objectCRUD.read = output.objectCRUD.edit =
        output.objectCRUD.create = output.objectCRUD.delete = true;
      }

      if (fieldNamesArr.length) {
        const qualified = fieldNamesArr.map(f => `'${obj}.${escapeSOQL(f)}'`).join(",");
        const flsRes    = await conn.query(`
          SELECT Field, PermissionsRead, PermissionsEdit FROM FieldPermissions
          WHERE  Field IN (${qualified}) AND ParentId IN ('${allIds.join("','")}')
        `);
        const flsMap = {};
        for (const r of flsRes.records) {
          const fname = r.Field.split(".")[1];
          if (!flsMap[fname]) flsMap[fname] = { read: false, edit: false };
          if (r.PermissionsRead) flsMap[fname].read = true;
          if (r.PermissionsEdit) flsMap[fname].edit = true;
        }
        if (output.systemOverrides.viewAllData || output.systemOverrides.modifyAllData) {
          for (const field of fieldNamesArr) {
            if (!flsMap[field]) flsMap[field] = { read: false, edit: false };
            if (output.systemOverrides.viewAllData)   flsMap[field].read = true;
            if (output.systemOverrides.modifyAllData) flsMap[field].edit = true;
          }
        }
        output.fieldLevelSecurity = flsMap;
      }

      if (recordId) {
        const rid        = escapeSOQL(recordId);
        const shareTable = getShareTableName(obj);
        let shareRows    = [];
        try {
          const shareRes = await conn.query(`
            SELECT UserOrGroupId, AccessLevel, RowCause FROM ${shareTable} WHERE ParentId = '${rid}'
          `);
          shareRows = shareRes.records;
        } catch (e) {
          output.recordSharing = { error: `Could not query ${shareTable}: ${e.message}` };
          shareRows = null;
        }

        if (shareRows !== null) {
          let matchingRows = [];
          let allGroupIds  = [uid];
          if (shareRows.length > 0) {
            const directGroups = await conn.query(`SELECT GroupId FROM GroupMember WHERE UserOrGroupId = '${uid}'`);
            allGroupIds        = await expandGroupIds(conn, [uid, ...directGroups.records.map(r => r.GroupId)]);
            matchingRows       = shareRows.filter(r => allGroupIds.includes(r.UserOrGroupId));
          }
          const accessRank = { Read: 1, Edit: 2, All: 3 };
          const best       = matchingRows.reduce(
            (b, r) => (accessRank[r.AccessLevel] ?? 0) > (accessRank[b] ?? 0) ? r.AccessLevel : b,
            "None"
          );
          output.recordSharing = {
            matchingRows:      matchingRows.map(r => ({ access: r.AccessLevel, cause: r.RowCause })),
            highestAccess:     best,
            roleHierarchyNote: "Role-hierarchy implicit grants are NOT evaluated here. Call sf_get_role_hierarchy.",
          };
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(output) }] };
    } catch (e) {
      console.error(`[Tool Error] sf_get_effective_permissions: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 12: Role Hierarchy  — FIX: Added MAX_DEPTH guard
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_role_hierarchy",
  "Resolve the full role hierarchy chain from a user's current role to the organization root. Optionally compare against a record owner to assess hierarchy-based implicit sharing",
  {
    userId:      z.string().describe("Salesforce User ID of the user being diagnosed"),
    ownerUserId: z.string().optional().describe("Optional: User ID of the record owner — if provided, returns whether hierarchy grants access"),
  },
  async ({ userId, ownerUserId }) => {
    try {
      const conn      = await getConn();
      const uid       = escapeSOQL(userId);
      // FIX: Max depth guard to prevent infinite loop
      const MAX_DEPTH = 20;

      const userRes = await conn.query(`
        SELECT Id, Name, UserRoleId, UserRole.Name, UserRole.ParentRoleId
        FROM   User WHERE Id = '${uid}' LIMIT 1
      `);
      if (!userRes.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }] };
      }

      const user = userRes.records[0];

      if (!user.UserRoleId) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              userId,
              hasRole:                 false,
              roleChain:               [],
              hierarchyGrantsPossible: false,
              note: "User has no role assigned. Role hierarchy cannot grant record access to this user.",
            }),
          }],
        };
      }

      const roleChain   = [];
      let currentRoleId = user.UserRoleId;
      let depth         = 0;

      while (currentRoleId && depth < MAX_DEPTH) {
        depth++;
        const roleRes = await conn.query(`
          SELECT Id, Name, DeveloperName, ParentRoleId
          FROM   UserRole WHERE Id = '${escapeSOQL(currentRoleId)}' LIMIT 1
        `);
        if (!roleRes.records.length) break;
        const role = roleRes.records[0];
        roleChain.push({ roleId: role.Id, name: role.Name, developerName: role.DeveloperName });
        currentRoleId = role.ParentRoleId ?? null;
      }

      // FIX: Warn if max depth was hit
      if (depth >= MAX_DEPTH) {
        console.warn(`[MCP] sf_get_role_hierarchy: MAX_DEPTH (${MAX_DEPTH}) reached — possible circular reference`);
      }

      const result = {
        userId,
        hasRole:        true,
        currentRoleId:  user.UserRoleId,
        currentRole:    user.UserRole?.Name ?? null,
        roleChain,
        roleChainDepth: roleChain.length,
        depthLimitHit:  depth >= MAX_DEPTH,
      };

      if (ownerUserId) {
        const ownerEsc = escapeSOQL(ownerUserId);
        const ownerRes = await conn.query(`
          SELECT Id, Name, UserRoleId, UserRole.Name FROM User WHERE Id = '${ownerEsc}' LIMIT 1
        `);

        if (!ownerRes.records.length) {
          result.ownerComparison = { error: "Owner user not found" };
        } else {
          const owner       = ownerRes.records[0];
          const ownerRoleId = owner.UserRoleId;
          const userRoleIds = new Set(roleChain.map(r => r.roleId));

          const ownerRoleChain = [];
          let   cid            = ownerRoleId;
          let   ownerDepth     = 0;

          while (cid && ownerDepth < MAX_DEPTH) {
            ownerDepth++;
            const r = await conn.query(`SELECT Id, Name, ParentRoleId FROM UserRole WHERE Id = '${escapeSOQL(cid)}' LIMIT 1`);
            if (!r.records.length) break;
            ownerRoleChain.push({ roleId: r.records[0].Id, name: r.records[0].Name });
            cid = r.records[0].ParentRoleId ?? null;
          }

          const userIsAncestor = ownerRoleChain.some(r => userRoleIds.has(r.roleId));
          const sameRole       = user.UserRoleId === ownerRoleId;

          result.ownerComparison = {
            ownerUserId,
            ownerName:             owner.Name,
            ownerRoleId:           ownerRoleId ?? null,
            ownerRoleName:         owner.UserRole?.Name ?? null,
            ownerRoleChain,
            userIsAncestorOfOwner: userIsAncestor,
            sameRole,
            hierarchyGrantsAccess: userIsAncestor && !sameRole,
            explanation: userIsAncestor && !sameRole
              ? `User's role (${user.UserRole?.Name}) is an ancestor of the owner's role (${owner.UserRole?.Name}). When OWD is Private or Public Read Only, Salesforce grants implicit read access up the hierarchy.`
              : sameRole
              ? "User and record owner are in the same role. Same-level peers do not share records via hierarchy."
              : "User's role is NOT an ancestor of the owner's role. Role hierarchy does not grant access here.",
          };
        }
      }

      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e) {
      console.error(`[Tool Error] sf_get_role_hierarchy: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 13: Object OWD
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_object_owd",
  "Retrieve the Org-Wide Default sharing model for an object without requiring a record ID",
  { objectType: z.string().describe("Object API name e.g. Account, Work_Schedule__c") },
  async ({ objectType }) => {
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);

      let owd = null;
      try {
        const owdResult = await conn.tooling.query(`
          SELECT QualifiedApiName, Label, InternalSharingModel, ExternalSharingModel, SharingModel
          FROM   EntityDefinition WHERE QualifiedApiName = '${obj}'
        `);
        owd = owdResult.records[0] ?? null;
      } catch {
        try {
          const owdFallback = await conn.tooling.query(`
            SELECT QualifiedApiName, Label, InternalSharingModel, ExternalSharingModel
            FROM   EntityDefinition WHERE QualifiedApiName = '${obj}'
          `);
          owd = owdFallback.records[0] ?? null;
        } catch (e2) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                objectType: obj,
                error: `Could not query EntityDefinition: ${e2.message}`,
                hint:  "Ensure the integration user has 'View Setup and Configuration' permission.",
              }),
            }],
          };
        }
      }

      if (!owd) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ objectType: obj, error: "Object not found in EntityDefinition. Verify the API name is correct." }),
          }],
        };
      }

      const internal           = owd.InternalSharingModel ?? "Unknown";
      const external           = owd.ExternalSharingModel ?? "Unknown";
      const hierarchyRelevant  = !["ReadWrite", "Read"].includes(internal);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType:                       obj,
            label:                            owd.Label ?? obj,
            internalSharingModel:             internal,
            externalSharingModel:             external,
            hierarchyAndSharingRulesRelevant: hierarchyRelevant,
            interpretation: hierarchyRelevant
              ? `OWD is '${internal}'. Role hierarchy and sharing rules are ACTIVE — users do NOT automatically see all records.`
              : `OWD is '${internal}'. All internal users with object Read permission can see all records.`,
          }),
        }],
      };
    } catch (e) {
      console.error(`[Tool Error] sf_get_object_owd: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 14: Muting PermSet Impact
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_get_muting_permset_impact",
  "Identify whether any Muting PermissionSet inside a PermissionSetGroup is actively suppressing access",
  {
    userId:     z.string().describe("Salesforce User ID"),
    objectType: z.string().describe("Object API name e.g. Account, Work_Schedule__c"),
    fieldName:  z.string().optional().describe("Optional: field API name to check FLS suppression e.g. AnnualRevenue"),
  },
  async ({ userId, objectType, fieldName }) => {
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);
      const uid  = escapeSOQL(userId);

      const { mutingIds, groupIds } = await getUserPermSetIds(conn, uid);

      if (!mutingIds.length) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              userId, objectType: obj,
              hasMutingPermSets: false,
              suppressedObject:  false,
              suppressedField:   null,
              message: "No Muting PermissionSets found.",
            }),
          }],
        };
      }

      const mutingObjPerms = await conn.query(`
        SELECT ParentId, PermissionsRead, PermissionsEdit, PermissionsCreate,
               PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
        FROM   ObjectPermissions
        WHERE  SobjectType = '${obj}'
        AND    ParentId IN ('${mutingIds.join("','")}')
      `);

      const suppressedCRUD = { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false };
      for (const r of mutingObjPerms.records) {
        if (r.PermissionsCreate)           suppressedCRUD.create    = true;
        if (r.PermissionsRead)             suppressedCRUD.read      = true;
        if (r.PermissionsEdit)             suppressedCRUD.edit      = true;
        if (r.PermissionsDelete)           suppressedCRUD.delete    = true;
        if (r.PermissionsViewAllRecords)   suppressedCRUD.viewAll   = true;
        if (r.PermissionsModifyAllRecords) suppressedCRUD.modifyAll = true;
      }

      const result = {
        userId, objectType: obj,
        hasMutingPermSets:    true,
        mutingPermSetIds:     mutingIds,
        permissionSetGroups:  groupIds,
        suppressedObjectCRUD: suppressedCRUD,
        anyCRUDSuppressed:    Object.values(suppressedCRUD).some(Boolean),
      };

      if (fieldName) {
        const fld       = escapeSOQL(fieldName);
        const qualified = `${obj}.${fld}`;
        const mutingFLS = await conn.query(`
          SELECT Field, PermissionsRead, PermissionsEdit FROM FieldPermissions
          WHERE  Field = '${qualified}' AND ParentId IN ('${mutingIds.join("','")}')
        `);
        const suppressedFLS = { read: false, edit: false };
        for (const r of mutingFLS.records) {
          if (r.PermissionsRead) suppressedFLS.read = true;
          if (r.PermissionsEdit) suppressedFLS.edit = true;
        }
        result.fieldName        = qualified;
        result.suppressedFLS    = suppressedFLS;
        result.anyFLSSuppressed = suppressedFLS.read || suppressedFLS.edit;
      }

      result.interpretation = result.anyCRUDSuppressed
        ? `SUPPRESSION DETECTED: A Muting PermSet in PSG (${groupIds.join(", ")}) is suppressing [${Object.entries(suppressedCRUD).filter(([,v]) => v).map(([k]) => k).join(", ")}] on ${obj}.`
        : `No object-level suppression on ${obj}.`;

      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e) {
      console.error(`[Tool Error] sf_get_muting_permset_impact: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOL 15: Explain Access Grant
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_explain_access_grant",
  "Trace and explain the complete grant chain for why a user has access",
  {
    userId:     z.string().describe("Salesforce User ID (18-char)"),
    objectType: z.string().describe("Object API name e.g. Account, Custom_Object__c"),
    fieldName:  z.string().optional().describe("Field API name without object prefix e.g. AnnualRevenue"),
  },
  async ({ userId, objectType, fieldName }) => {
    try {
      const conn        = await getConn();
      const safeUserId  = userId.trim();
      const uid         = escapeSOQL(safeUserId);
      const obj         = escapeSOQL(objectType);

      const assignmentRes = await conn.query(`
        SELECT PermissionSetId,
               PermissionSet.Name,
               PermissionSet.Label,
               PermissionSet.IsOwnedByProfile,
               PermissionSet.PermissionSetGroupId,
               PermissionSet.PermissionSetGroup.DeveloperName,
               PermissionSet.Profile.Name
        FROM   PermissionSetAssignment WHERE AssigneeId = '${uid}'
      `);

      if (!assignmentRes.records.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No PermissionSet assignments found for user" }) }] };
      }

      const psMetaMap = {};
      for (const r of assignmentRes.records) {
        const psId = r.PermissionSetId;
        let source, sourceName;
        if (r.PermissionSet?.IsOwnedByProfile) {
          source = "Profile"; sourceName = r.PermissionSet?.Profile?.Name ?? "Unknown Profile";
        } else if (r.PermissionSet?.PermissionSetGroupId) {
          source = "PermissionSetGroup"; sourceName = r.PermissionSet?.PermissionSetGroup?.DeveloperName ?? r.PermissionSet?.PermissionSetGroupId;
        } else {
          source = "DirectAssignment"; sourceName = null;
        }
        psMetaMap[psId] = { psId, name: r.PermissionSet?.Name ?? psId, label: r.PermissionSet?.Label ?? psId, source, sourceName };
      }

      const allIds = Object.keys(psMetaMap);
      const result = {
        userId: safeUserId, objectType: obj, fieldName: fieldName ?? null,
        objectAccessGrants: [], fieldAccessGrants: [], systemOverrideGrants: [],
        roleHierarchyNote: "This tool only shows PermSet/Profile grants. If no grants are found but the user still has access, check sf_get_role_hierarchy.",
        summary: {},
      };

      const objPermRes = await conn.query(`
        SELECT ParentId, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete,
               PermissionsViewAllRecords, PermissionsModifyAllRecords
        FROM   ObjectPermissions
        WHERE  SobjectType = '${obj}' AND ParentId IN ('${allIds.join("','")}')
      `);

      for (const r of objPermRes.records) {
        const meta   = psMetaMap[r.ParentId];
        const grants = [];
        if (r.PermissionsCreate)           grants.push("Create");
        if (r.PermissionsRead)             grants.push("Read");
        if (r.PermissionsEdit)             grants.push("Edit");
        if (r.PermissionsDelete)           grants.push("Delete");
        if (r.PermissionsViewAllRecords)   grants.push("ViewAll");
        if (r.PermissionsModifyAllRecords) grants.push("ModifyAll");
        if (grants.length) {
          result.objectAccessGrants.push({
            permissionSetId: meta.psId, permissionSetName: meta.name,
            permissionSetLabel: meta.label, assignedVia: meta.source,
            assignedViaName: meta.sourceName, grantsOnObject: grants,
          });
        }
      }

      const sysPermRes = await conn.query(`
        SELECT Id, Name, IsOwnedByProfile, PermissionsViewAllData, PermissionsModifyAllData
        FROM   PermissionSet WHERE Id IN ('${allIds.join("','")}')
        AND    (PermissionsViewAllData = true OR PermissionsModifyAllData = true)
      `);

      for (const r of sysPermRes.records) {
        const meta   = psMetaMap[r.Id];
        const grants = [];
        if (r.PermissionsViewAllData)   grants.push("ViewAllData (system-wide override)");
        if (r.PermissionsModifyAllData) grants.push("ModifyAllData (system-wide override)");
        result.systemOverrideGrants.push({
          permissionSetId: meta.psId, permissionSetName: meta.name,
          permissionSetLabel: meta.label, assignedVia: meta.source,
          assignedViaName: meta.sourceName, systemGrants: grants,
          note: "System overrides bypass all Object/FLS/Sharing checks",
        });
      }

      if (fieldName) {
        const fld       = escapeSOQL(fieldName);
        const qualField = `${obj}.${fld}`;
        const flsRes    = await conn.query(`
          SELECT ParentId, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions
          WHERE  Field = '${qualField}' AND ParentId IN ('${allIds.join("','")}')
          AND    (PermissionsRead = true OR PermissionsEdit = true)
        `);
        for (const r of flsRes.records) {
          const meta   = psMetaMap[r.ParentId];
          const grants = [];
          if (r.PermissionsRead) grants.push("Read");
          if (r.PermissionsEdit) grants.push("Edit");
          result.fieldAccessGrants.push({
            field: qualField, permissionSetId: meta.psId,
            permissionSetName: meta.name, permissionSetLabel: meta.label,
            assignedVia: meta.source, assignedViaName: meta.sourceName, grantsOnField: grants,
          });
        }
      }

      const effectiveCRUD     = { create: false, read: false, edit: false, delete: false, viewAll: false, modifyAll: false };
      for (const g of result.objectAccessGrants) {
        if (g.grantsOnObject.includes("Create"))    effectiveCRUD.create    = true;
        if (g.grantsOnObject.includes("Read"))      effectiveCRUD.read      = true;
        if (g.grantsOnObject.includes("Edit"))      effectiveCRUD.edit      = true;
        if (g.grantsOnObject.includes("Delete"))    effectiveCRUD.delete    = true;
        if (g.grantsOnObject.includes("ViewAll"))   effectiveCRUD.viewAll   = true;
        if (g.grantsOnObject.includes("ModifyAll")) effectiveCRUD.modifyAll = true;
      }
      const hasSystemOverride = result.systemOverrideGrants.length > 0;

      result.summary = {
        hasObjectAccess:                   result.objectAccessGrants.length > 0 || hasSystemOverride,
        effectiveObjectCRUD:               effectiveCRUD,
        hasSystemOverride,
        totalPermSetsGrantingObjectAccess: result.objectAccessGrants.length,
        ...(fieldName ? {
          hasFieldAccess: result.fieldAccessGrants.length > 0 || hasSystemOverride,
          effectiveFieldFLS: {
            read: result.fieldAccessGrants.some(g => g.grantsOnField.includes("Read")) || hasSystemOverride,
            edit: result.fieldAccessGrants.some(g => g.grantsOnField.includes("Edit")) || hasSystemOverride,
          },
          totalPermSetsGrantingFieldAccess: result.fieldAccessGrants.length,
          fieldAccessNote: hasSystemOverride ? "System override bypasses FLS" : null,
        } : {}),
        grantChainBreakdown: [
          ...result.objectAccessGrants.map(g =>
            `Object [${g.grantsOnObject.join(", ")}] ← PermSet "${g.permissionSetName}" (${g.assignedVia}${g.assignedViaName ? `: ${g.assignedViaName}` : ""})`
          ),
          ...(fieldName ? result.fieldAccessGrants.map(g =>
            `Field [${g.grantsOnField.join(", ")}] ← PermSet "${g.permissionSetName}" (${g.assignedVia}${g.assignedViaName ? `: ${g.assignedViaName}` : ""})`
          ) : []),
          ...result.systemOverrideGrants.map(g =>
            `System Override [${g.systemGrants.join(", ")}] ← PermSet "${g.permissionSetName}" (${g.assignedVia}${g.assignedViaName ? `: ${g.assignedViaName}` : ""})`
          ),
        ],
      };

      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e) {
      console.error(`[Tool Error] sf_explain_access_grant: ${e.message}`);
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// TOOLS 16-30 (unchanged logic, same as original)
// ─────────────────────────────────────────────────────────────

server.tool(
  "sf_assign_permission_set",
  "Assign a permission set or permission set group to one or more users. Idempotent—skips users who already have the assignment",
  {
    permissionSetName: z.string().describe("API name of the PermissionSet or PermissionSetGroup"),
    userIds:           z.string().describe("Comma-separated Salesforce User IDs"),
    isGroup:           z.string().optional().describe("Set to 'true' if the name refers to a PermissionSetGroup"),
  },
  async ({ permissionSetName, userIds, isGroup }) => {
    try {
      const conn     = await getConn();
      const psName   = escapeSOQL(permissionSetName);
      const uids     = userIds.split(",").map(id => escapeSOQL(id.trim())).filter(Boolean);
      const useGroup = isGroup === "true";

      if (useGroup) {
        const res = await conn.query(`SELECT Id FROM PermissionSetGroup WHERE DeveloperName = '${psName}' LIMIT 1`);
        if (!res.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSetGroup '${psName}' not found` }) }] };
        const psgId       = res.records[0].Id;
        const existing    = await conn.query(`SELECT AssigneeId FROM PermissionSetAssignment WHERE PermissionSetGroupId = '${psgId}' AND AssigneeId IN ('${uids.join("','")}') `);
        const alreadyAssigned = new Set(existing.records.map(r => r.AssigneeId));
        const toAssign        = uids.filter(id => !alreadyAssigned.has(id));
        const results         = { alreadyHadAssignment: [...alreadyAssigned], assigned: [], failed: [] };
        if (toAssign.length) {
          const insertRes = await conn.sobject("PermissionSetAssignment").create(toAssign.map(uid => ({ AssigneeId: uid, PermissionSetGroupId: psgId })));
          const arr = Array.isArray(insertRes) ? insertRes : [insertRes];
          arr.forEach((r, i) => { if (r.success) results.assigned.push(toAssign[i]); else results.failed.push({ userId: toAssign[i], errors: r.errors }); });
        }
        return { content: [{ type: "text", text: JSON.stringify({ permissionSetGroup: psName, psgId, ...results }) }] };
      } else {
        const res = await conn.query(`SELECT Id FROM PermissionSet WHERE Name = '${psName}' AND IsOwnedByProfile = false LIMIT 1`);
        if (!res.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found` }) }] };
        const psId            = res.records[0].Id;
        const existing        = await conn.query(`SELECT AssigneeId FROM PermissionSetAssignment WHERE PermissionSetId = '${psId}' AND AssigneeId IN ('${uids.join("','")}') `);
        const alreadyAssigned = new Set(existing.records.map(r => r.AssigneeId));
        const toAssign        = uids.filter(id => !alreadyAssigned.has(id));
        const results         = { alreadyHadAssignment: [...alreadyAssigned], assigned: [], failed: [] };
        if (toAssign.length) {
          const insertRes = await conn.sobject("PermissionSetAssignment").create(toAssign.map(uid => ({ AssigneeId: uid, PermissionSetId: psId })));
          const arr = Array.isArray(insertRes) ? insertRes : [insertRes];
          arr.forEach((r, i) => { if (r.success) results.assigned.push(toAssign[i]); else results.failed.push({ userId: toAssign[i], errors: r.errors }); });
        }
        return { content: [{ type: "text", text: JSON.stringify({ permissionSet: psName, psId, ...results }) }] };
      }
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_revoke_permission_set",
  "Remove a permission set assignment from one or more users",
  {
    permissionSetName: z.string().describe("API name of the PermissionSet to revoke"),
    userIds:           z.string().describe("Comma-separated Salesforce User IDs"),
  },
  async ({ permissionSetName, userIds }) => {
    try {
      const conn   = await getConn();
      const psName = escapeSOQL(permissionSetName);
      const uids   = userIds.split(",").map(id => escapeSOQL(id.trim())).filter(Boolean);
      const psRes  = await conn.query(`SELECT Id, IsOwnedByProfile FROM PermissionSet WHERE Name = '${psName}' LIMIT 1`);
      if (!psRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found` }) }] };
      const ps = psRes.records[0];
      if (ps.IsOwnedByProfile) return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot revoke a Profile-owned PermissionSet." }) }] };
      const assignments = await conn.query(`SELECT Id, AssigneeId FROM PermissionSetAssignment WHERE PermissionSetId = '${ps.Id}' AND AssigneeId IN ('${uids.join("','")}') `);
      if (!assignments.records.length) return { content: [{ type: "text", text: JSON.stringify({ message: "None of the specified users had this PermissionSet assigned.", userIds: uids }) }] };
      const deleteRes = await conn.sobject("PermissionSetAssignment").destroy(assignments.records.map(r => r.Id));
      const arr       = Array.isArray(deleteRes) ? deleteRes : [deleteRes];
      const revoked   = [], failed = [];
      arr.forEach((r, i) => { const uid = assignments.records[i].AssigneeId; if (r.success) revoked.push(uid); else failed.push({ userId: uid, errors: r.errors }); });
      return { content: [{ type: "text", text: JSON.stringify({ permissionSet: psName, revoked, failed }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_update_object_permissions",
  "Grant or revoke specific CRUD permissions on an object within a permission set",
  {
    permissionSetName: z.string(),
    objectType:        z.string(),
    create:    z.string().optional(),
    read:      z.string().optional(),
    edit:      z.string().optional(),
    del:       z.string().optional(),
    viewAll:   z.string().optional(),
    modifyAll: z.string().optional(),
  },
  async ({ permissionSetName, objectType, create, read, edit, del, viewAll, modifyAll }) => {
    try {
      const conn   = await getConn();
      const psName = escapeSOQL(permissionSetName);
      const obj    = escapeSOQL(objectType);
      const psRes  = await conn.query(`SELECT Id FROM PermissionSet WHERE Name = '${psName}' AND IsOwnedByProfile = false LIMIT 1`);
      if (!psRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found or is Profile-owned` }) }] };
      const psId    = psRes.records[0].Id;
      const existing = await conn.query(`SELECT Id, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${psId}' AND SobjectType = '${obj}'`);
      const toBool  = (val, fallback) => val === undefined ? fallback : val === "true";

      function enforceDependencies(p) {
        if (p.PermissionsModifyAllRecords) { p.PermissionsViewAllRecords = true; p.PermissionsRead = true; p.PermissionsEdit = true; p.PermissionsCreate = true; p.PermissionsDelete = true; }
        if (p.PermissionsViewAllRecords)   { p.PermissionsRead = true; }
        if (p.PermissionsEdit && !p.PermissionsRead)   p.PermissionsRead = true;
        if (p.PermissionsCreate && !p.PermissionsRead) p.PermissionsRead = true;
        if (p.PermissionsDelete && !p.PermissionsRead) p.PermissionsRead = true;
        return p;
      }

      let opResult;
      if (existing.records.length) {
        const rec     = existing.records[0];
        const updated = enforceDependencies({ Id: rec.Id, PermissionsCreate: toBool(create, rec.PermissionsCreate), PermissionsRead: toBool(read, rec.PermissionsRead), PermissionsEdit: toBool(edit, rec.PermissionsEdit), PermissionsDelete: toBool(del, rec.PermissionsDelete), PermissionsViewAllRecords: toBool(viewAll, rec.PermissionsViewAllRecords), PermissionsModifyAllRecords: toBool(modifyAll, rec.PermissionsModifyAllRecords) });
        opResult = await conn.sobject("ObjectPermissions").update(updated);
      } else {
        const newRec = enforceDependencies({ ParentId: psId, SobjectType: obj, PermissionsCreate: toBool(create, false), PermissionsRead: toBool(read, false), PermissionsEdit: toBool(edit, false), PermissionsDelete: toBool(del, false), PermissionsViewAllRecords: toBool(viewAll, false), PermissionsModifyAllRecords: toBool(modifyAll, false) });
        opResult = await conn.sobject("ObjectPermissions").create(newRec);
      }
      const success = Array.isArray(opResult) ? opResult[0].success : opResult.success;
      const errors  = Array.isArray(opResult) ? opResult[0].errors  : opResult.errors;
      return { content: [{ type: "text", text: JSON.stringify({ permissionSet: psName, objectType: obj, action: existing.records.length ? "updated" : "created", success, errors: errors ?? [] }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_update_field_security",
  "Create or modify field-level security read and edit permissions within a permission set",
  {
    permissionSetName: z.string(),
    fields: z.string().describe("Comma-separated qualified field names e.g. 'Account.Phone,Account.AnnualRevenue'"),
    read:   z.string().describe("'true' or 'false'"),
    edit:   z.string().optional().describe("'true' or 'false' (requires read=true)"),
  },
  async ({ permissionSetName, fields, read, edit }) => {
    try {
      const conn      = await getConn();
      const psName    = escapeSOQL(permissionSetName);
      const grantRead = read === "true";
      const grantEdit = edit === "true";
      if (grantEdit && !grantRead) return { content: [{ type: "text", text: JSON.stringify({ error: "edit=true requires read=true." }) }] };
      const psRes = await conn.query(`SELECT Id FROM PermissionSet WHERE Name = '${psName}' AND IsOwnedByProfile = false LIMIT 1`);
      if (!psRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found or is Profile-owned` }) }] };
      const psId      = psRes.records[0].Id;
      const fieldList = fields.split(",").map(f => escapeSOQL(f.trim())).filter(Boolean);
      const qualified = fieldList.map(f => `'${f}'`).join(",");
      const existing  = await conn.query(`SELECT Id, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '${psId}' AND Field IN (${qualified})`);
      const existingMap  = Object.fromEntries(existing.records.map(r => [r.Field, r]));
      const toUpdate     = [], toInsert = [], updateIdToField = new Map(), results = [];
      for (const field of fieldList) {
        if (existingMap[field]) { const u = { Id: existingMap[field].Id, PermissionsRead: grantRead, PermissionsEdit: grantEdit }; toUpdate.push(u); updateIdToField.set(existingMap[field].Id, field); }
        else toInsert.push({ ParentId: psId, Field: field, PermissionsRead: grantRead, PermissionsEdit: grantEdit });
      }
      if (toUpdate.length) { const res = await conn.sobject("FieldPermissions").update(toUpdate); (Array.isArray(res) ? res : [res]).forEach((r, i) => { results.push({ field: updateIdToField.get(toUpdate[i].Id) ?? "unknown", action: "updated", success: r.success, errors: r.errors ?? [] }); }); }
      if (toInsert.length) { const res = await conn.sobject("FieldPermissions").create(toInsert); (Array.isArray(res) ? res : [res]).forEach((r, i) => { results.push({ field: toInsert[i].Field, action: "created", success: r.success, errors: r.errors ?? [] }); }); }
      return { content: [{ type: "text", text: JSON.stringify({ permissionSet: psName, results }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_update_apex_class_access",
  "Grant or revoke Apex class access permissions within a permission set",
  {
    permissionSetName: z.string(),
    apexClassName:     z.string(),
    grant:             z.string().describe("'true' to grant access, 'false' to revoke"),
  },
  async ({ permissionSetName, apexClassName, grant }) => {
    try {
      const conn    = await getConn();
      const psName  = escapeSOQL(permissionSetName);
      const cls     = escapeSOQL(apexClassName);
      const doGrant = grant === "true";
      const psRes   = await conn.query(`SELECT Id FROM PermissionSet WHERE Name = '${psName}' AND IsOwnedByProfile = false LIMIT 1`);
      if (!psRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found` }) }] };
      const psId   = psRes.records[0].Id;
      const clsRes = await conn.query(`SELECT Id FROM ApexClass WHERE Name = '${cls}' LIMIT 1`);
      if (!clsRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `ApexClass '${cls}' not found` }) }] };
      const clsId    = clsRes.records[0].Id;
      const existing = await conn.query(`SELECT Id FROM SetupEntityAccess WHERE ParentId = '${psId}' AND SetupEntityId = '${clsId}'`);
      let result;
      if (doGrant && !existing.records.length)  { const r = await conn.sobject("SetupEntityAccess").create({ ParentId: psId, SetupEntityId: clsId }); result = { action: "granted", success: r.success, errors: r.errors ?? [] }; }
      else if (!doGrant && existing.records.length) { const r = await conn.sobject("SetupEntityAccess").destroy(existing.records[0].Id); result = { action: "revoked", success: r.success, errors: r.errors ?? [] }; }
      else result = { action: "no_change", reason: doGrant ? "Already had access" : "Did not have access", success: true };
      return { content: [{ type: "text", text: JSON.stringify({ permissionSet: psName, apexClass: cls, ...result }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_change_user_profile",
  "Reassign a user to a different profile. High-impact change—requires explicit confirmation before execution",
  {
    userId:      z.string(),
    profileName: z.string(),
    confirm:     z.string().describe("Must be 'YES_I_CONFIRM' to execute"),
  },
  async ({ userId, profileName, confirm }) => {
    try {
      if (confirm !== "YES_I_CONFIRM") return { content: [{ type: "text", text: JSON.stringify({ error: "Profile change blocked. Set confirm='YES_I_CONFIRM' to proceed." }) }] };
      const conn       = await getConn();
      const uid        = escapeSOQL(userId);
      const pName      = escapeSOQL(profileName);
      const profileRes = await conn.query(`SELECT Id, Name, UserLicenseId FROM Profile WHERE Name = '${pName}' LIMIT 1`);
      if (!profileRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `Profile '${pName}' not found` }) }] };
      const profileId = profileRes.records[0].Id;
      const userRes   = await conn.query(`SELECT Id, Username, ProfileId, Profile.Name, UserType FROM User WHERE Id = '${uid}' LIMIT 1`);
      if (!userRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: "User not found" }) }] };
      const user      = userRes.records[0];
      const updateRes = await conn.sobject("User").update({ Id: uid, ProfileId: profileId });
      return { content: [{ type: "text", text: JSON.stringify({ userId: uid, username: user.Username, previousProfile: { id: user.ProfileId, name: user.Profile?.Name }, newProfile: { id: profileId, name: pName }, success: updateRes.success, errors: updateRes.errors ?? [] }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_manage_record_sharing",
  "Create or delete a manual share record granting specific user or group access to a record",
  {
    action:      z.string().describe("'grant' or 'revoke'"),
    objectType:  z.string(),
    recordId:    z.string(),
    targetId:    z.string(),
    accessLevel: z.string().optional().describe("'Read' or 'Edit' (default: Read)"),
  },
  async ({ action, objectType, recordId, targetId, accessLevel }) => {
    try {
      const conn  = await getConn();
      const obj   = escapeSOQL(objectType);
      const rid   = escapeSOQL(recordId);
      const tid   = escapeSOQL(targetId);
      const level = accessLevel ?? "Read";
      const act   = action.trim().toLowerCase();
      if (!["grant", "revoke"].includes(act)) return { content: [{ type: "text", text: JSON.stringify({ error: "action must be 'grant' or 'revoke'" }) }] };
      if (act === "grant" && !["Read", "Edit"].includes(level)) return { content: [{ type: "text", text: JSON.stringify({ error: "accessLevel must be 'Read' or 'Edit'" }) }] };
      const shareTable = getShareTableName(obj);
      if (act === "grant") {
        const existing = await conn.query(`SELECT Id FROM ${shareTable} WHERE ParentId = '${rid}' AND UserOrGroupId = '${tid}' AND RowCause = 'Manual'`).catch(() => ({ records: [] }));
        if (existing.records.length) { const r = await conn.sobject(shareTable).update({ Id: existing.records[0].Id, AccessLevel: level }); return { content: [{ type: "text", text: JSON.stringify({ action: "updated_existing", shareTable, recordId: rid, targetId: tid, accessLevel: level, success: r.success, errors: r.errors ?? [] }) }] }; }
        const r = await conn.sobject(shareTable).create({ ParentId: rid, UserOrGroupId: tid, AccessLevel: level, RowCause: "Manual" });
        return { content: [{ type: "text", text: JSON.stringify({ action: "granted", shareTable, recordId: rid, targetId: tid, accessLevel: level, shareId: r.id, success: r.success, errors: r.errors ?? [] }) }] };
      } else {
        const existing = await conn.query(`SELECT Id FROM ${shareTable} WHERE ParentId = '${rid}' AND UserOrGroupId = '${tid}' AND RowCause = 'Manual'`).catch(() => ({ records: [] }));
        if (!existing.records.length) return { content: [{ type: "text", text: JSON.stringify({ action: "no_change", reason: "No manual share record found" }) }] };
        const r = await conn.sobject(shareTable).destroy(existing.records[0].Id);
        return { content: [{ type: "text", text: JSON.stringify({ action: "revoked", shareTable, recordId: rid, targetId: tid, success: r.success, errors: r.errors ?? [] }) }] };
      }
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_get_role_users_access",
  "Retrieve all active users in a specific role and their object permission levels",
  {
    roleName:   z.string(),
    objectType: z.string(),
  },
  async ({ roleName, objectType }) => {
    try {
      const conn = await getConn();
      const role = escapeSOQL(roleName);
      const obj  = escapeSOQL(objectType);
      const users = await conn.query(`SELECT Id, Name, Username FROM User WHERE UserRole.Name = '${role}' AND IsActive = true`);
      if (!users.records.length) return { content: [{ type: "text", text: JSON.stringify({ role, objectType: obj, message: "No active users found in this role." }) }] };
      const userIds    = users.records.map(u => `'${u.Id}'`).join(",");
      const assignments = await conn.query(`SELECT AssigneeId, PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId IN (${userIds})`);
      const psIdsByUser = {};
      for (const a of assignments.records) { psIdsByUser[a.AssigneeId] ??= []; psIdsByUser[a.AssigneeId].push(a.PermissionSetId); }
      const allPsIds = [...new Set(assignments.records.map(a => a.PermissionSetId))];
      let objPermsMap = {};
      if (allPsIds.length) {
        const objPerms = await conn.query(`SELECT ParentId, PermissionsRead, PermissionsModifyAllRecords FROM ObjectPermissions WHERE SobjectType = '${obj}' AND ParentId IN ('${allPsIds.join("','")}') `);
        for (const r of objPerms.records) objPermsMap[r.ParentId] = r;
      }
      const usersWithAccess = users.records.map(u => {
        const userPsIds = psIdsByUser[u.Id] ?? [];
        return { userId: u.Id, name: u.Name, username: u.Username, canRead: userPsIds.some(id => objPermsMap[id]?.PermissionsRead), canModifyAll: userPsIds.some(id => objPermsMap[id]?.PermissionsModifyAllRecords) };
      });
      return { content: [{ type: "text", text: JSON.stringify({ role, objectType: obj, userCount: users.records.length, users: usersWithAccess }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_audit_role_access",
  "Bulk audit users in a role with specific object access. Results capped at 20 users",
  {
    roleName:   z.string(),
    objectType: z.string(),
  },
  async ({ roleName, objectType }) => {
    try {
      const conn = await getConn();
      const role = escapeSOQL(roleName);
      const obj  = escapeSOQL(objectType);
      const CAP  = 20;
      const users = await conn.query(`SELECT Id, Name FROM User WHERE UserRole.Name = '${role}' AND IsActive = true`);
      if (!users.records.length) return { content: [{ type: "text", text: JSON.stringify({ role, objectType: obj, message: "No users in this role." }) }] };
      const truncated   = users.records.length > CAP;
      const evalRecords = users.records.slice(0, CAP);
      const evalIds     = evalRecords.map(u => `'${u.Id}'`).join(",");
      const assignments = await conn.query(`SELECT AssigneeId, PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId IN (${evalIds})`);
      const psIdsByUser = {};
      for (const a of assignments.records) { psIdsByUser[a.AssigneeId] ??= []; psIdsByUser[a.AssigneeId].push(a.PermissionSetId); }
      const allPsIds = [...new Set(assignments.records.map(a => a.PermissionSetId))];
      let objPermsMap = {};
      if (allPsIds.length) {
        const objPerms = await conn.query(`SELECT ParentId, PermissionsRead, PermissionsModifyAllRecords FROM ObjectPermissions WHERE SobjectType = '${obj}' AND ParentId IN ('${allPsIds.join("','")}') `);
        for (const r of objPerms.records) objPermsMap[r.ParentId] = r;
      }
      const auditResults = evalRecords.map(u => { const userPsIds = psIdsByUser[u.Id] ?? []; return { userName: u.Name, canRead: userPsIds.some(id => objPermsMap[id]?.PermissionsRead), canModifyAll: userPsIds.some(id => objPermsMap[id]?.PermissionsModifyAllRecords) }; });
      return { content: [{ type: "text", text: JSON.stringify({ role, objectType: obj, totalUsersInRole: users.records.length, evaluated: auditResults.length, truncated, truncatedAt: truncated ? CAP : null, results: auditResults }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_audit_all_modify_all_users",
  "Organization-wide audit: identify all users carrying ModifyAll or ViewAll system overrides",
  {},
  async () => {
    try {
      const conn          = await getConn();
      const permSetResult = await conn.query(`SELECT Assignee.Name, Assignee.Username, Assignee.UserRole.Name, PermissionSet.Name, PermissionSet.Label FROM PermissionSetAssignment WHERE PermissionSetId IN (SELECT ParentId FROM ObjectPermissions WHERE SobjectType = 'Account' AND PermissionsModifyAllRecords = true)`);
      const adminPermSets = await conn.query(`SELECT Id FROM PermissionSet WHERE IsOwnedByProfile = true AND (PermissionsModifyAllData = true OR PermissionsViewAllData = true)`);
      let systemAdminUsers = [];
      if (adminPermSets.records.length) {
        const psIds    = adminPermSets.records.map(r => `'${r.Id}'`).join(",");
        const usersRes = await conn.query(`SELECT Assignee.Name, Assignee.Username FROM PermissionSetAssignment WHERE PermissionSetId IN (${psIds}) AND Assignee.IsActive = true`);
        systemAdminUsers = usersRes.records.map(r => ({ name: r.Assignee?.Name, username: r.Assignee?.Username }));
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            byPermissionSets: permSetResult.records.map(r => ({ name: r.Assignee?.Name ?? "Unknown", username: r.Assignee?.Username ?? "Unknown", role: r.Assignee?.UserRole?.Name ?? "No Role Assigned", permSetName: r.PermissionSet?.Name || r.PermissionSet?.Label || "Unknown PermSet" })),
            systemAdminOverrides: systemAdminUsers,
            totalCount: permSetResult.totalSize + systemAdminUsers.length,
          }),
        }],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_audit_crud_access",
  "Organization-wide audit: identify all users with specific CRUD permissions on a given object",
  {
    objectType: z.string(),
    crudType:   z.string().describe("Create, Read, Edit, Delete, ViewAll, ModifyAll"),
  },
  async ({ objectType, crudType }) => {
    try {
      const conn     = await getConn();
      const obj      = escapeSOQL(objectType);
      const fieldMap = { Create: "PermissionsCreate", Read: "PermissionsRead", Edit: "PermissionsEdit", Delete: "PermissionsDelete", ViewAll: "PermissionsViewAllRecords", ModifyAll: "PermissionsModifyAllRecords" };
      const fieldName = fieldMap[crudType];
      if (!fieldName) return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid crudType. Use Create, Read, Edit, Delete, ViewAll, or ModifyAll." }) }] };
      const result = await conn.query(`SELECT Assignee.Name, Assignee.Username, Assignee.UserRole.Name, PermissionSet.Name, PermissionSet.Label, PermissionSet.IsOwnedByProfile, PermissionSet.Profile.Name FROM PermissionSetAssignment WHERE PermissionSetId IN (SELECT ParentId FROM ObjectPermissions WHERE SobjectType = '${obj}' AND ${fieldName} = true)`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            objectType: obj, permissionChecked: crudType,
            users: result.records.map(r => {
              const psName = r.PermissionSet?.Name ?? ""; const psLabel = r.PermissionSet?.Label ?? ""; const profName = r.PermissionSet?.Profile?.Name ?? ""; const isProfile = r.PermissionSet?.IsOwnedByProfile ?? false;
              const looksLikeId = /^[a-zA-Z0-9]{15,18}$/.test(psName) && !psName.includes(" ");
              const permissionSource = isProfile ? `Profile: ${profName || psName}` : looksLikeId ? (psLabel || psName || "Unknown PermSet") : (psName || psLabel || "Unknown PermSet");
              return { name: r.Assignee?.Name ?? "Unknown", username: r.Assignee?.Username ?? "Unknown", role: r.Assignee?.UserRole?.Name ?? "No Role Assigned", permissionSource };
            }),
            totalCount: result.totalSize,
          }),
        }],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_audit_shadow_admins",
  "Identify hidden admin users: those with object Read access plus system-wide ModifyAllData or ViewAllData",
  { objectType: z.string() },
  async ({ objectType }) => {
    try {
      const conn      = await getConn();
      const obj       = escapeSOQL(objectType);
      const readUsers = await conn.query(`SELECT Assignee.Name, Assignee.Username, PermissionSet.Name, AssigneeId FROM PermissionSetAssignment WHERE PermissionSetId IN (SELECT ParentId FROM ObjectPermissions WHERE SobjectType = '${obj}' AND PermissionsRead = true)`);
      if (!readUsers.records.length) return { content: [{ type: "text", text: JSON.stringify({ objectType: obj, message: "No users with Read access found.", shadowAdmins: [], normalUsers: [] }) }] };
      const userIds    = [...new Set(readUsers.records.map(r => r.AssigneeId))];
      const escapedIds = userIds.map(id => `'${escapeSOQL(id)}'`).join(",");
      const systemPerms = await conn.query(`SELECT AssigneeId, PermissionSet.PermissionsModifyAllData, PermissionSet.PermissionsViewAllData, PermissionSet.PermissionsModifyAllRecords FROM PermissionSetAssignment WHERE AssigneeId IN (${escapedIds}) AND (PermissionSet.PermissionsModifyAllData = true OR PermissionSet.PermissionsViewAllData = true OR PermissionSet.PermissionsModifyAllRecords = true)`);
      const shadowMap = new Map();
      for (const r of systemPerms.records) {
        const existing = shadowMap.get(r.AssigneeId) ?? { modifyAllData: false, viewAllData: false, modifyAllRecords: false };
        shadowMap.set(r.AssigneeId, { modifyAllData: existing.modifyAllData || (r.PermissionSet?.PermissionsModifyAllData ?? false), viewAllData: existing.viewAllData || (r.PermissionSet?.PermissionsViewAllData ?? false), modifyAllRecords: existing.modifyAllRecords || (r.PermissionSet?.PermissionsModifyAllRecords ?? false) });
      }
      const seenUsers = new Map();
      for (const r of readUsers.records) { if (!seenUsers.has(r.AssigneeId)) seenUsers.set(r.AssigneeId, { name: r.Assignee?.Name, username: r.Assignee?.Username, permissionSource: r.PermissionSet?.Name ?? "Unknown" }); }
      const shadowAdmins = [], normalUsers = [];
      for (const [userId, user] of seenUsers.entries()) {
        const flags = shadowMap.get(userId); const isShadow = !!flags;
        const entry = { name: user.name, username: user.username, permissionSource: user.permissionSource, isShadowAdmin: isShadow, systemFlags: flags ?? null, riskLevel: flags?.modifyAllData ? "CRITICAL" : flags?.modifyAllRecords ? "HIGH" : flags?.viewAllData ? "MEDIUM" : "NONE" };
        if (isShadow) shadowAdmins.push(entry); else normalUsers.push(entry);
      }
      return { content: [{ type: "text", text: JSON.stringify({ objectType: obj, totalUsersWithRead: seenUsers.size, shadowAdminCount: shadowAdmins.length, shadowAdmins, normalUsers, summary: shadowAdmins.length ? `⚠️ ${shadowAdmins.length} shadow admin(s) found.` : `✅ No shadow admins found for ${obj}.` }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_search_records",
  "Search for Salesforce records by name or keyword to locate a record ID for use in other tools",
  {
    objectType:  z.string(),
    searchTerm:  z.string(),
    limitCount:  z.string().optional(),
  },
  async ({ objectType, searchTerm, limitCount }) => {
    try {
      const conn  = await getConn();
      const obj   = escapeSOQL(objectType);
      const term  = escapeSOQL(searchTerm);
      const limit = parseInt(limitCount ?? "5", 10);
      let records = [];
      try {
        const res = await conn.query(`SELECT Id, Name, OwnerId, CreatedDate FROM ${obj} WHERE Name LIKE '%${term}%' LIMIT ${limit}`);
        records = res.records;
      } catch {
        try {
          const sosl = await conn.search(`FIND {${term}} IN NAME FIELDS RETURNING ${obj}(Id, Name, OwnerId) LIMIT ${limit}`);
          records = sosl.searchRecords ?? [];
        } catch (e2) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Could not search ${obj}: ${e2.message}`, hint: "Object may not support Name-based search." }) }] };
        }
      }
      if (!records.length) return { content: [{ type: "text", text: JSON.stringify({ objectType: obj, searchTerm, results: [], message: `No ${obj} records found matching '${searchTerm}'.` }) }] };
      return { content: [{ type: "text", text: JSON.stringify({ objectType: obj, searchTerm, resultCount: records.length, results: records.map(r => ({ recordId: r.Id, name: r.Name ?? "(no name)", ownerId: r.OwnerId, createdDate: r.CreatedDate })), hint: "Use recordId from these results in sf_get_record_owner or sf_get_sharing_rules." }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_get_user_list",
  "Search for active Salesforce users by partial name, email, profile, or role",
  {
    searchTerm:  z.string().optional(),
    profileName: z.string().optional(),
    roleName:    z.string().optional(),
    limitCount:  z.string().optional(),
  },
  async ({ searchTerm, profileName, roleName, limitCount }) => {
    try {
      const conn       = await getConn();
      const limit      = parseInt(limitCount ?? "10", 10);
      const conditions = ["IsActive = true"];
      if (searchTerm)  conditions.push(`(Name LIKE '%${escapeSOQL(searchTerm)}%' OR Username LIKE '%${escapeSOQL(searchTerm)}%' OR Email LIKE '%${escapeSOQL(searchTerm)}%')`);
      if (profileName) conditions.push(`Profile.Name = '${escapeSOQL(profileName)}'`);
      if (roleName)    conditions.push(`UserRole.Name = '${escapeSOQL(roleName)}'`);
      const res = await conn.query(`SELECT Id, Name, Username, Email, Profile.Name, UserRole.Name, UserType, IsActive FROM User WHERE ${conditions.join(" AND ")} ORDER BY Name LIMIT ${limit}`);
      return { content: [{ type: "text", text: JSON.stringify({ resultCount: res.records.length, users: res.records.map(u => ({ userId: u.Id, name: u.Name, username: u.Username, email: u.Email, profile: u.Profile?.Name ?? null, role: u.UserRole?.Name ?? null, userType: u.UserType })) }) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_get_permset_details",
  "Retrieve complete details of a named permission set including object permissions, system flags, and active user count",
  {
    permissionSetName: z.string(),
    objectType:        z.string().optional(),
  },
  async ({ permissionSetName, objectType }) => {
    try {
      const conn   = await getConn();
      const psName = escapeSOQL(permissionSetName);
      const psRes  = await conn.query(`SELECT Id, Name, Label, Description, IsOwnedByProfile, PermissionSetGroupId, PermissionsViewAllData, PermissionsModifyAllData, PermissionsApiEnabled, PermissionsManageUsers, PermissionsAuthorApex, PermissionsCustomizeApplication FROM PermissionSet WHERE Name = '${psName}' LIMIT 1`);
      if (!psRes.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: `PermissionSet '${psName}' not found` }) }] };
      const ps           = psRes.records[0];
      const assigneeCount = await conn.query(`SELECT COUNT() FROM PermissionSetAssignment WHERE PermissionSetId = '${ps.Id}' AND Assignee.IsActive = true`);
      const objFilter     = objectType ? `AND SobjectType = '${escapeSOQL(objectType)}'` : "";
      const objPerms      = await conn.query(`SELECT SobjectType, PermissionsCreate, PermissionsRead, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${ps.Id}' ${objFilter} ORDER BY SobjectType`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            id: ps.Id, name: ps.Name, label: ps.Label, description: ps.Description,
            isOwnedByProfile: ps.IsOwnedByProfile, isInGroup: !!ps.PermissionSetGroupId, groupId: ps.PermissionSetGroupId ?? null,
            activeAssigneeCount: assigneeCount.totalSize,
            systemPermissions: { viewAllData: ps.PermissionsViewAllData, modifyAllData: ps.PermissionsModifyAllData, apiEnabled: ps.PermissionsApiEnabled, manageUsers: ps.PermissionsManageUsers, authorApex: ps.PermissionsAuthorApex, customizeApplication: ps.PermissionsCustomizeApplication },
            objectPermissions: objPerms.records.map(r => ({ object: r.SobjectType, create: r.PermissionsCreate, read: r.PermissionsRead, edit: r.PermissionsEdit, delete: r.PermissionsDelete, viewAll: r.PermissionsViewAllRecords, modifyAll: r.PermissionsModifyAllRecords })),
          }),
        }],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ status: "error", reason: e.message }) }] };
    }
  }
);

server.tool(
  "sf_audit_record_access",
  "Comprehensive audit of all users and groups with access to a specific record",
  {
    objectType: z.string(),
    recordId:   z.string(),
  },
  async ({ objectType, recordId }) => {
    try {
      const conn = await getConn();
      const obj  = escapeSOQL(objectType);
      const rid  = escapeSOQL(recordId);
      const output = [];

      const ownerResult = await conn.query(`SELECT Id, OwnerId, Owner.Name, Owner.Username FROM ${obj} WHERE Id = '${rid}' LIMIT 1`);
      if (!ownerResult.records.length) return { content: [{ type: "text", text: JSON.stringify({ error: "Record not found." }) }] };

      const owner = ownerResult.records[0].Owner;
      output.push({ userId: owner.Id, name: owner.Name, username: owner.Username, access: "Read/Edit", source: "Owner" });

      const owd        = await conn.tooling.query(`SELECT InternalSharingModel FROM EntityDefinition WHERE QualifiedApiName = '${obj}'`);
      const sharingModel = owd.records[0]?.InternalSharingModel ?? "Unknown";

      // FIX: Use safe getShareTableName helper
      const shareTable = getShareTableName(obj);
      let shares = [];
      try {
        const s = await conn.query(`SELECT UserOrGroupId, AccessLevel, RowCause FROM ${shareTable} WHERE ParentId = '${rid}'`);
        shares = s.records;
      } catch (e) {
        console.warn(`[MCP] Could not query ${shareTable}: ${e.message}`);
      }

      for (const row of shares) {
        if (row.UserOrGroupId.startsWith("005")) {
          const u = await conn.query(`SELECT Id, Name, Username FROM User WHERE Id = '${row.UserOrGroupId}'`);
          if (u.records.length) {
            output.push({ userId: u.records[0].Id, name: u.records[0].Name, username: u.records[0].Username, access: row.AccessLevel, source: row.RowCause });
          }
        }
      }

      const unique = [...new Map(output.map(i => [i.userId, i])).values()];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ objectType: obj, recordId: rid, sharingModel, totalUsers: unique.length, users: unique }),
        }],
      };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[MCP] SF Permissions Advanced v4.2.0 — Production Ready");