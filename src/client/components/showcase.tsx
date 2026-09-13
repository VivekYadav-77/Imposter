"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Drawer,
  Field,
  IdentityToken,
  PhaseBar,
  Progress,
  SkeletonList,
  Tabs,
  Timer,
  Toast,
} from "./ui";

export function Showcase() {
  const [tab, setTab] = useState("controls");
  const [drawer, setDrawer] = useState(false);
  return (
    <main id="main-content" className="showcase">
      <p className="eyebrow">Development only</p>
      <h1>Component showcase</h1>
      <Tabs
        label="Component groups"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "controls", label: "Controls" },
          { id: "feedback", label: "Feedback" },
        ]}
      />
      <section className="showcase-grid">
        <article className="card">
          <h2>Actions</h2>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Destructive</Button>
          <Button loading>Loading</Button>
        </article>
        <article className="card">
          <h2>Inputs</h2>
          <Field label="Nickname" hint="24 characters maximum" placeholder="Case name" />
          <Field label="Invalid field" error="Check this value." defaultValue="Wrong" />
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
        </article>
        <article className="card">
          <h2>Status</h2>
          <div className="component-row">
            <Badge>Draft</Badge>
            <Badge tone="success">Accepted</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Rejected</Badge>
          </div>
          <Progress value={3} max={5} label="Evidence processed" />
          <IdentityToken name="Ada Lovelace" status="connected" />
        </article>
        <article className="card">
          <h2>Feedback</h2>
          <Banner tone="info">Informational message</Banner>
          <Banner tone="danger">Action failed safely</Banner>
          <Toast>Room reconnected.</Toast>
        </article>
        <article className="card">
          <h2>Loading</h2>
          <SkeletonList count={2} />
        </article>
      </section>
      <section className="showcase-phase">
        <PhaseBar phase="meeting" identity="Ada">
          <Timer deadline={new Date(Date.now() + 90_000).toISOString()} />
        </PhaseBar>
      </section>
      <Drawer open={drawer} title="Roster drawer" onClose={() => setDrawer(false)}>
        <p>Drawer content remains keyboard-operable and uses a labeled close control.</p>
      </Drawer>
    </main>
  );
}
