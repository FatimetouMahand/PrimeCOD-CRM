import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Crée 2 comptes par défaut pour démarrer après un déploiement :
//
//   Admin : +22200000000  /  Admin@123
//   Agent : +22241000001  /  Agent@123
//
// Utilisation :
//
//   1. Valeurs par défaut :
//      npx tsx scripts/create-admin.ts
//
//   2. Via variables d'environnement (recommandé en production) :
//      ADMIN_NAME="Mohamed" ADMIN_PHONE="+22241234567" ADMIN_PASSWORD="Fort@456" \
//      AGENT_NAME="Fatima"  AGENT_PHONE="+22247654321" AGENT_PASSWORD="Agent@456" \
//        npx tsx scripts/create-admin.ts
//
//   3. Mode interactif (questions) :
//      npx tsx scripts/create-admin.ts --interactive
//
//   Sans risque : utilise upsert — peut être relancé plusieurs fois.
// ─────────────────────────────────────────────────────────────────────────────

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, a => { rl.close(); resolve(a.trim()); }));
}

async function getCredentials() {
  const interactive = process.argv.includes("--interactive");

  if (interactive) {
    console.log("\n Création des comptes — mode interactif\n");
    console.log("-- Compte Admin --");
    const adminName     = await ask("Nom Admin        (ex: Mohamed Salem)  : ");
    const adminPhone    = await ask("Tel  Admin       (ex: +22241234567)   : ");
    const adminPassword = await ask("Mdp  Admin       (min. 6 caracteres)  : ");

    console.log("\n-- Compte Agent --");
    const agentName     = await ask("Nom Agent        (ex: Fatima Mint)    : ");
    const agentPhone    = await ask("Tel  Agent       (ex: +22247654321)   : ");
    const agentPassword = await ask("Mdp  Agent       (min. 6 caracteres)  : ");

    return { adminName, adminPhone, adminPassword, agentName, agentPhone, agentPassword };
  }

  return {
    adminName:     process.env.ADMIN_NAME     || "Admin",
    adminPhone:    process.env.ADMIN_PHONE    || "+22200000000",
    adminPassword: process.env.ADMIN_PASSWORD || "Admin@123",
    agentName:     process.env.AGENT_NAME     || "Agent Test",
    agentPhone:    process.env.AGENT_PHONE    || "+22241000001",
    agentPassword: process.env.AGENT_PASSWORD || "Agent@123",
  };
}

async function main() {
  const {
    adminName, adminPhone, adminPassword,
    agentName, agentPhone, agentPassword,
  } = await getCredentials();

  // Validation
  for (const [label, value] of [
    ["Admin name",     adminName],
    ["Admin phone",    adminPhone],
    ["Admin password", adminPassword],
    ["Agent name",     agentName],
    ["Agent phone",    agentPhone],
    ["Agent password", agentPassword],
  ] as [string, string][]) {
    if (!value) { console.error(`\nERREUR: ${label} est requis`); process.exit(1); }
  }
  if (adminPassword.length < 6) { console.error("\nERREUR: Mot de passe Admin trop court (min. 6)"); process.exit(1); }
  if (agentPassword.length  < 6) { console.error("\nERREUR: Mot de passe Agent trop court (min. 6)");  process.exit(1); }

  console.log("\nCreation des comptes...");
  console.log("   DB:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "locale");

  // Créer / mettre à jour Admin
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where:  { phone: adminPhone },
    update: { name: adminName, password: adminHash, role: "Admin", suspended: false },
    create: { name: adminName, phone: adminPhone, password: adminHash, role: "Admin" },
  });

  // Créer / mettre à jour Agent
  const agentHash = await bcrypt.hash(agentPassword, 10);
  const agent = await prisma.user.upsert({
    where:  { phone: agentPhone },
    update: { name: agentName, password: agentHash, role: "Agent", suspended: false },
    create: { name: agentName, phone: agentPhone, password: agentHash, role: "Agent" },
  });

  const line = "=".repeat(56);
  console.log("\n" + line);
  console.log("Comptes prets !");
  console.log(line);

  console.log("\n[ADMIN]");
  console.log("   Telephone   :", admin.phone);
  console.log("   Mot de passe:", adminPassword);
  console.log("   Role        :", admin.role);

  console.log("\n[AGENT]");
  console.log("   Telephone   :", agent.phone);
  console.log("   Mot de passe:", agentPassword);
  console.log("   Role        :", agent.role);

  console.log("\n" + line);
  console.log("Partagez ces identifiants avec votre client.");
  console.log("Demandez-leur de changer les mots de passe a la premiere connexion.\n");
}

main()
  .catch(e => { console.error("\nErreur:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
