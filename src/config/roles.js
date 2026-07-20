export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  AUDITOR: 'auditor',
  DEPT_HEAD: 'dept_head',
  QUALITY_MGR: 'quality_mgr',
  VIEWER: 'viewer',
};

export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ORG_ADMIN]: 80,
  [ROLES.QUALITY_MGR]: 60,
  [ROLES.AUDITOR]: 40,
  [ROLES.DEPT_HEAD]: 20,
  [ROLES.VIEWER]: 10,
};

export const canManageUsers = (role) =>
  [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN].includes(role);

export const canManageTemplates = (role) =>
  [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.QUALITY_MGR].includes(role);

export const canCreateAudits = (role) =>
  [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.AUDITOR].includes(role);

export const canManageNCs = (role) =>
  [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.QUALITY_MGR, ROLES.DEPT_HEAD].includes(role);

export const canApproveNCs = (role) =>
  [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.QUALITY_MGR].includes(role);
