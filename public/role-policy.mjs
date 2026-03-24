export function resolveLoginRole({ existingRole, requestedRole }) {
  if (existingRole) {
    return { allowed: true, role: existingRole };
  }

  if (requestedRole === 'CANDIDATE') {
    return { allowed: true, role: 'CANDIDATE' };
  }

  return {
    allowed: false,
    role: null,
    message: 'Employer access requires an approved account.',
  };
}
