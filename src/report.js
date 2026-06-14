export function buildMarkdownReport(snapshot) {
  const lines = [];

  lines.push("# App Store price monitor");
  lines.push("");
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push(`Base currency: ${snapshot.baseCurrency}`);
  lines.push(`Exchange rates: ${snapshot.exchange.provider}, updated ${snapshot.exchange.updatedAt || "unknown"}`);
  lines.push("");

  for (const target of snapshot.targets) {
    lines.push(`## ${target.name} (${target.platform}, ${target.appId})`);
    lines.push("");
    lines.push(
      `Supported countries with prices: ${target.countryCount} / ${target.requestedCountryCount || target.countryCount}`
    );
    if (target.filteredCountryCount) {
      lines.push(`Filtered unsupported or incomplete countries: ${target.filteredCountryCount}`);
    }
    lines.push("");

    if (!target.subscriptionPlans.length) {
      lines.push("No subscription prices were found for the supported countries.");
      lines.push("");
    }

    for (const plan of target.subscriptionPlans) {
      lines.push(`### ${plan.name} (${formatPeriod(plan.billingPeriod)})`);
      lines.push("");
      lines.push(formatStats(plan, snapshot.baseCurrency));
      lines.push("");
      lines.push(`| Country | Local price | Price in ${snapshot.baseCurrency} | Currency | Offer |`);
      lines.push("| --- | ---: | ---: | --- | --- |");

      for (const price of plan.prices) {
        lines.push(
          row([
            `${price.country} ${price.countryName || ""}`.trim(),
            price.localPrice || "-",
            formatBaseAmount(price.priceInBase, snapshot.baseCurrency),
            price.currency || "-",
            price.offerName || "-"
          ])
        );
      }

      lines.push("");
    }

    if (target.oneTimePurchases.length) {
      lines.push("### Other in-app purchases");
      lines.push("");
      for (const product of target.oneTimePurchases) {
        lines.push(`#### ${product.name}`);
        lines.push("");
        lines.push(`| Country | Local price | Price in ${snapshot.baseCurrency} | Currency | Offer |`);
        lines.push("| --- | ---: | ---: | --- | --- |");
        for (const price of product.prices) {
          lines.push(
            row([
              `${price.country} ${price.countryName || ""}`.trim(),
              price.localPrice || "-",
              formatBaseAmount(price.priceInBase, snapshot.baseCurrency),
              price.currency || "-",
              price.offerName || "-"
            ])
          );
        }
        lines.push("");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatStats(plan, baseCurrency) {
  if (!plan.stats || plan.stats.min == null) {
    return `Countries: ${plan.countryCount}`;
  }

  return [
    `Countries: ${plan.countryCount}`,
    `Min: ${formatBaseAmount(plan.stats.min, baseCurrency)}`,
    `Median: ${formatBaseAmount(plan.stats.median, baseCurrency)}`,
    `Average: ${formatBaseAmount(plan.stats.average, baseCurrency)}`,
    `Max: ${formatBaseAmount(plan.stats.max, baseCurrency)}`,
    `Spread: ${formatBaseAmount(plan.stats.spread, baseCurrency)}`
  ].join(" | ");
}

function formatPeriod(period) {
  const labels = {
    P1W: "weekly",
    P1M: "monthly",
    P1Y: "yearly"
  };
  return labels[period] || period || "subscription";
}

function formatBaseAmount(amount, baseCurrency) {
  if (amount == null) {
    return "-";
  }
  return `${amount.toFixed(2)} ${baseCurrency}`;
}

function escapeCell(value) {
  return String(value ?? "-").replace(/\|/g, "\\|");
}

function row(values) {
  return `| ${values.map(escapeCell).join(" | ")} |`;
}
