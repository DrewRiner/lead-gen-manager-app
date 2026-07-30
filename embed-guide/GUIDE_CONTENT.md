# GUIDE: Embed an Engine Evolve contact form on a website

Category: Integrations
Slug: embed-a-contact-form-on-a-website

## Why this matters
A form only collects leads once it's actually on a live web page. Building the form
in Engine Evolve isn't enough — you have to embed its code into the property's
website so real visitors can fill it out. Until the embed code is on the page, the
form exists but no leads can come through it.

## Before you start
- The property's lead form already built in Engine Evolve (with the Source field
  and hidden honeypot set — see "Set up a new lead gen property").
- Access to the property's website builder (e.g. Weebly).
- Know which page the form should appear on.

## Steps

### Step 1 — Open the form and click Integrate  [IMAGE: 01-engine-evolve-integrate-copy-embed-code.png]
In Engine Evolve, open the property's lead form. Click **Integrate** in the top
right. In the "Embed or Share Form" dialog, choose **Embed Code** on the left.

### Step 2 — Choose Inline layout and copy the code  [IMAGE: 01-engine-evolve-integrate-copy-embed-code.png]
Set Embed Layout Type to **Inline** (the form sits directly in the page rather than
as a popup or sidebar). Leave Trigger on "Always show" and Deactivation on "Never
deactivate" so the form is always visible. Click **Copy embed code**.
WARNING: Use Inline for a lead-gen landing page. Popup/slide-in can be missed or
dismissed, costing you leads.

### Step 3 — Add an Embed Code element to the website  [IMAGE: 02-weebly-add-embed-code-element.png]
In the website builder (Weebly shown here), drag an **Embed Code** element onto the
page where you want the form — typically next to the main copy or below the call
button. It drops in as a "Custom HTML" block.

### Step 4 — Paste the embed code  [IMAGE: 03-weebly-paste-embed-code-in-block.png]
Click **Edit Custom HTML** on the block and paste the embed code you copied from
Engine Evolve. You'll see the `<iframe src="...leadconnectorhq.com/widget/form/...">`
code appear. The form preview renders in the block.
WARNING: Paste the code exactly as copied. Don't edit the iframe src or the
data-form-id — those tie the form to the right property's routing.

### Step 5 — Publish the website
Click **Publish** in the website builder. The form is now live on the page and will
start collecting leads.

## How to check it worked
Visit the live published page, fill out the form yourself as a test, and submit.
Confirm the test lead lands on that property's page in the dashboard (not in
Unmatched). If it lands correctly, the form is fully embedded and live.
