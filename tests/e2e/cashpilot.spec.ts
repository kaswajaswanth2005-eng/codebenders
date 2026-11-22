import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

function kolkataToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function watchForPageFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) {
      failures.push(message.text());
    }
  });
  return failures;
}

async function sendAssistantMessage(page: Page, message: string) {
  const input = page.getByLabel("Message CashPilot");
  await input.fill(message);
  await input.press("Enter");
}

test("complete invoice-to-action journey uses persistent application data", async ({ page, context }) => {
  const failures = watchForPageFailures(page);
  const today = kolkataToday();
  const dueDate = addDays(today, 30);
  const expectedDate = addDays(today, 5);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Recorded cash", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action Center" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByLabel("Business name *")).toHaveValue("Creative Studio Demo");
  await page.getByLabel("Owner name *").fill("Demo Owner E2E");
  await page.getByRole("button", { name: "Save business details" }).click();
  await expect(page.getByText("Business details saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Owner name *")).toHaveValue("Demo Owner E2E");

  await page.goto("/customers/new");
  await page.getByLabel("Customer name *").fill("E2E Studio Client");
  await page.getByLabel("Company").fill("E2E Studio Client Pvt Ltd");
  await page.getByLabel("Email").fill("e2e@example.test");
  await page.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("heading", { name: "E2E Studio Client" })).toBeVisible();

  await page.goto("/invoices/new");
  await page.getByLabel("Customer *").selectOption({ label: "E2E Studio Client" });
  await page.getByLabel("Issue date *").fill(today);
  await page.getByLabel("Due date *").fill(dueDate);
  await page.getByLabel("Expected collection date").fill(expectedDate);
  await page.getByLabel("Invoice number").fill("E2E-INV-001");
  await page.getByLabel("Item 1 description").fill("Brand identity package");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price ₹").fill("40000");
  await expect(page.getByText("Invoice total: ₹40,000")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();

  await expect(page.getByRole("heading", { name: "E2E-INV-001" })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText("Unpaid", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("E2E-INV-001.pdf");
  const pdfPath = await download.path();
  expect(pdfPath).not.toBeNull();
  const pdf = await readFile(pdfPath!);
  expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");

  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount in ₹ *").fill("15000");
  await page.getByLabel("Payment date *").fill(today);
  await page.getByLabel("Method *").selectOption("UPI");
  await page.getByLabel("Reference").fill("E2E-UPI-001");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("₹25,000", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Reminder text")).toHaveValue(/₹25,000 outstanding/);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByText("Copied to clipboard.")).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("E2E-INV-001");
  expect(clipboard).toContain("₹25,000");

  const revisedCollection = addDays(today, 8);
  await page.getByLabel("Expected collection date").last().fill(revisedCollection);
  await page.getByRole("button", { name: "Save expectation" }).click();
  await expect(page.getByText("Forecast expectation updated.")).toBeVisible();

  await page.goto(`/invoices?dueFrom=${dueDate}&dueTo=${dueDate}`);
  await expect(page.getByRole("link", { name: "E2E-INV-001" })).toBeVisible();

  await page.goto("/bills/new");
  await page.getByLabel("Title *").fill("E2E Supplier Bill");
  await page.getByLabel("Category *").selectOption("Suppliers");
  await page.getByLabel("Amount in ₹ *").fill("12000");
  await page.getByLabel("First due date *").fill(addDays(today, 12));
  await page.getByLabel("Repeats *").selectOption("NONE");
  await page.getByRole("button", { name: "Save bill" }).click();
  await expect(page.getByText("E2E Supplier Bill")).toBeVisible();

  await page.goto("/forecast?horizon=30");
  await expect(page.getByRole("heading", { name: "Cash Forecast" })).toBeVisible();
  const simulationInvoiceId = await page
    .locator("#simulate-invoice option")
    .filter({ hasText: "E2E-INV-001" })
    .getAttribute("value");
  expect(simulationInvoiceId).toBeTruthy();
  await page.locator("#simulate-invoice").selectOption(simulationInvoiceId!);
  await page.getByRole("button", { name: "15 days" }).click();
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByRole("heading", { name: /Simulation result: E2E-INV-001/ })).toBeVisible();
  await expect(page.getByText("This simulation does not change any invoice or payment.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "E2E-INV-001" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action Center" })).toBeVisible();

  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "CashPilot Assistant" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("This section is not built yet");
  expect(failures).toEqual([]);
});

test("assistant keeps invoice follow-up replies in the pending invoice workflow", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const today = kolkataToday();
  const dueDate = addDays(today, 21);

  await page.goto("/assistant");
  await page
    .getByLabel("Message CashPilot")
    .fill("Create an invoice of 5000 for Aurora Brands");
  await page.getByLabel("Message CashPilot").press("Enter");
  await expect(page.getByText(/Invoice for Aurora Brands, .*5,000/)).toBeVisible();
  await expect(page.getByText("default 14-day payment term", { exact: false })).toBeVisible();

  await page.getByLabel("Message CashPilot").fill("no due date");
  await page.getByLabel("Message CashPilot").press("Enter");
  await expect(page.getByText("Every CashPilot invoice needs a due date", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("I can’t create or modify invoices");

  await page.getByLabel("Message CashPilot").fill(`due ${dueDate}`);
  await page.getByLabel("Message CashPilot").press("Enter");
  await expect(page.getByText(`Due date updated to ${dueDate}`, { exact: false })).toBeVisible();

  await page.getByLabel("Message CashPilot").fill("confirm");
  await page.getByLabel("Message CashPilot").press("Enter");
  await expect(page.getByText(/Saved draft invoice INV-/)).toBeVisible();
  await page.getByRole("link", { name: "View invoice" }).click();
  await expect(page.getByText(dueDate, { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("assistant validates, replaces, and cancels pending invoice drafts", async ({ page }) => {
  const failures = watchForPageFailures(page);
  const today = kolkataToday();
  const pastDate = addDays(today, -1);

  await page.goto("/assistant");
  await sendAssistantMessage(page, "Create an invoice of 5000 for Aurora Brands");
  await expect(page.getByRole("button", { name: "Confirm and save" })).toBeVisible();

  await sendAssistantMessage(page, "due 2026-02-30");
  await expect(page.getByText("real date in YYYY-MM-DD format", { exact: false })).toBeVisible();

  await sendAssistantMessage(page, `due ${pastDate}`);
  await expect(page.getByText("cannot be before the issue date", { exact: false })).toBeVisible();

  await sendAssistantMessage(page, "Create an invoice of 6250.75 for Bluebird Foods");
  await expect(page.getByText(/Invoice for Bluebird Foods, .*6,250\.75/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm and save" })).toHaveCount(1);

  await sendAssistantMessage(page, "cancel");
  await expect(page.getByText("Cancelled. Nothing was saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm and save" })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("assistant can create a new customer and invoice only after confirmation", async ({ page }) => {
  const failures = watchForPageFailures(page);
  const customerName = "Assistant E2E New Customer";

  await page.goto("/assistant");
  await sendAssistantMessage(page, `Create an invoice of 4321 for ${customerName}`);
  await expect(page.getByText(`No customer named '${customerName}' exists`, { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create customer and invoice" })).toBeVisible();

  const beforeConfirm = await page.request.get(`/api/customers?search=${encodeURIComponent(customerName)}`);
  expect(beforeConfirm.ok()).toBe(true);
  expect((await beforeConfirm.json()).data).toHaveLength(0);

  await page.getByRole("button", { name: "Create customer and invoice" }).click();
  await expect(page.getByText(/Saved draft invoice INV-/)).toBeVisible();
  await page.getByRole("link", { name: "View invoice" }).click();
  await expect(page.getByText(customerName, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("assistant asks the user to disambiguate similar customers", async ({ page }) => {
  const failures = watchForPageFailures(page);
  for (const name of ["Assistant Alpha Labs", "Assistant Alpha Studio"]) {
    const response = await page.request.post("/api/customers", { data: { name } });
    expect(response.status()).toBe(201);
  }

  await page.goto("/assistant");
  await sendAssistantMessage(page, "Create an invoice of 2500 for Assistant Alpha");
  await expect(page.getByText("Which customer did you mean?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assistant Alpha Labs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assistant Alpha Studio" })).toBeVisible();

  await page.getByRole("button", { name: "Assistant Alpha Labs" }).click();
  await expect(page.getByText(/Invoice for Assistant Alpha Labs, .*2,500/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Cancelled. Nothing was saved.", { exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

test("assistant handles local conversation, offline AI, input validation, and consent API security", async ({ page }) => {
  const failures = watchForPageFailures(page);

  const statusResponse = await page.request.get("/api/assistant/status");
  expect(statusResponse.ok()).toBe(true);
  expect((await statusResponse.json()).data).toMatchObject({ configured: false, available: false });

  const enabled = await page.request.put("/api/assistant/consent", { data: { consent: true } });
  expect(enabled.ok()).toBe(true);
  expect((await enabled.json()).data).toMatchObject({ consented: true, configured: false, available: false });

  const invalid = await page.request.put("/api/assistant/consent", { data: { consent: "yes" } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error.code).toBe("VALIDATION_ERROR");

  const forbidden = await page.request.put("/api/assistant/consent", {
    data: { consent: false },
    headers: { Origin: "https://attacker.example" },
  });
  expect(forbidden.status()).toBe(403);

  const disabled = await page.request.put("/api/assistant/consent", { data: { consent: false } });
  expect(disabled.ok()).toBe(true);
  expect((await disabled.json()).data).toMatchObject({ consented: false, available: false });

  await page.goto("/assistant");
  await sendAssistantMessage(page, "hi");
  await expect(page.getByText("Hi! I’m CashPilot.", { exact: false })).toBeVisible();

  await sendAssistantMessage(page, "How much money do customers owe me?");
  await expect(page.getByText("Online AI answers are not configured yet", { exact: false })).toBeVisible();

  await sendAssistantMessage(page, "Create an invoice for Aurora Brands");
  await expect(page.getByText("Tell me the amount", { exact: false })).toBeVisible();
  await sendAssistantMessage(page, "Create an invoice of -500 for Aurora Brands");
  await expect(page.getByText("more than 0", { exact: false })).toBeVisible();
  await sendAssistantMessage(page, "Create an invoice of 5000.999 for Aurora Brands");
  await expect(
    page.getByText("no more than 2 decimal places", { exact: false }).last(),
  ).toBeVisible();
  expect(failures).toEqual([]);
});

test("mobile layout and keyboard entry points remain usable", async ({ page }) => {
  const failures = watchForPageFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cash Forecast" })).toBeVisible();
  const hasHorizontalPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalPageOverflow).toBe(false);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.goto("/invoices");
  await expect(page.getByLabel("Due from")).toBeVisible();
  await expect(page.getByLabel("Due to")).toBeVisible();
  await page.goto("/bills?status=OVERDUE");
  await expect(page.getByLabel("Status")).toHaveValue("OVERDUE");

  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "CashPilot Assistant" })).toBeVisible();
  await expect(page.getByLabel("Message CashPilot")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create an invoice draft" })).toBeVisible();
  const assistantHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(assistantHasHorizontalOverflow).toBe(false);
  await sendAssistantMessage(page, "hi");
  await expect(page.getByText("Hi! I’m CashPilot.", { exact: false })).toBeVisible();
  expect(failures).toEqual([]);
});
