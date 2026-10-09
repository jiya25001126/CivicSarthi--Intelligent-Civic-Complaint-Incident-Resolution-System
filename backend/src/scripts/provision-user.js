import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { departmentRepository } from '../repositories/department.repository.js';

export async function runProvision(args = process.argv.slice(2)) {
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      parsed[key] = vals.join('=') || true;
    }
  }

  const email = (parsed.email || process.env.PROVISION_EMAIL || '').trim().toLowerCase();
  const name = (parsed.name || process.env.PROVISION_NAME || '').trim();
  const role = (parsed.role || process.env.PROVISION_ROLE || 'admin').trim().toLowerCase();
  const departmentId = (parsed.departmentId || process.env.PROVISION_DEPARTMENT_ID || '').trim() || null;
  let password = parsed.password || process.env.PROVISION_PASSWORD;
  let generatedPassword = false;

  console.log('====================================================');
  console.log('CivicSarthi User & Administrator Provisioning Tool');
  console.log('====================================================');

  if (!email) {
    console.error('[Error] --email=<email> is required');
    console.log('Usage: node src/scripts/provision-user.js --email=admin@example.com --name="Admin Name" [--role=admin|officer] [--departmentId=DEPT_ROADS] [--password=secret]');
    process.exit(1);
  }

  if (!name) {
    console.error('[Error] --name=<full name> is required');
    process.exit(1);
  }

  if (!['admin', 'officer'].includes(role)) {
    console.error(`[Error] Invalid role '${role}'. Only 'admin' and 'officer' can be provisioned via CLI.`);
    process.exit(1);
  }

  if (role === 'officer') {
    if (!departmentId) {
      console.error('[Error] --departmentId is required when provisioning an officer.');
      process.exit(1);
    }
    const exists = await departmentRepository.exists(departmentId);
    if (!exists) {
      console.error(`[Error] Department '${departmentId}' not found in registered departments.`);
      process.exit(1);
    }
  }

  // Check if account already exists
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    console.log(`[Notice] User with email '${email}' already exists with role '${existing.role}'.`);
    if (!parsed.force) {
      console.log('Use --force to update existing user password and role.');
      return existing;
    }
  }

  // Generate a cryptographically strong password if not explicitly supplied
  if (!password) {
    password = `Cs!${crypto.randomBytes(12).toString('base64url')}9`;
    generatedPassword = true;
  }

  const executor = {
    id: 'CLI_ADMIN_PROVISIONER',
    email: 'cli-admin@civicsarthi.internal',
    role: 'admin'
  };

  try {
    let resultUser;
    if (existing && parsed.force) {
      const bcrypt = (await import('bcryptjs')).default;
      const hash = await bcrypt.hash(password, 10);
      resultUser = await userRepository.update(existing.id, {
        passwordHash: hash,
        role,
        departmentId: role === 'officer' ? departmentId : null,
        name
      });
      console.log(`[Success] Updated user '${email}' (ID: ${resultUser.id})`);
    } else {
      resultUser = await authService.provisionUser({
        email,
        name,
        password,
        role,
        departmentId
      }, executor);
      console.log(`[Success] Successfully provisioned new ${role.toUpperCase()} account:`);
    }

    console.log(`  User ID:       ${resultUser.id}`);
    console.log(`  Name:          ${resultUser.name}`);
    console.log(`  Email:         ${resultUser.email}`);
    console.log(`  Role:          ${resultUser.role}`);
    if (resultUser.departmentId) {
      console.log(`  Department:    ${resultUser.departmentId}`);
    }

    if (generatedPassword) {
      console.log('----------------------------------------------------');
      console.log('  GENERATED ONE-TIME CREDENTIALS (SAVE SECURELY):');
      console.log(`  Password:      ${password}`);
      console.log('----------------------------------------------------');
    } else {
      console.log('  Password:      [Specified via CLI argument]');
    }

    return resultUser;
  } catch (err) {
    console.error('[Error] Provisioning failed:', err.message);
    process.exit(1);
  }
}

// Direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runProvision().catch(err => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
}

export default runProvision;
