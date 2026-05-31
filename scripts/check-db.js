const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    const version = await p.$queryRaw`SELECT version()`;
    console.log("PostgreSQL version:", version[0].version);

    const counts = {
      Users: await p.user.count(),
      Orders: await p.order.count(),
      Products: await p.product.count(),
      Statuses: await p.status.count(),
      Shopify_stores: await p.shopifyStore.count(),
    };
    console.log("\nDatabase content:");
    Object.entries(counts).forEach(([k, v]) => console.log(" - " + k + ":", v));

    const size = await p.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
    console.log("\nDatabase size:", size[0].size);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.$disconnect();
  }
})();
