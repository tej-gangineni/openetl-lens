import React, { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Group, Modal, NavLink, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { IconAlertCircle, IconArrowLeft, IconCircleCheck } from "@tabler/icons-react";
import TypeIcon from "./TypeIcon.jsx";
import { TYPES, TYPE_IDS } from "./typeMeta.js";
import { plural } from "./nav.js";
import { postJson } from "./api.js";

function TypeStep({ onPick }) {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">What do you want to connect? Lens only reads from it and never changes your data.</Text>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        {TYPE_IDS.map((id) => (
          <Paper key={id} withBorder radius="md">
            <NavLink
              component="button"
              type="button"
              label={<Text fw={600} size="sm">{TYPES[id].label}</Text>}
              description={TYPES[id].blurb}
              leftSection={<TypeIcon type={id} size={36} />}
              onClick={() => onPick(id)}
              py="sm"
            />
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

const clean = (values) => {
  const { name, ...rest } = values;
  const config = {};
  for (const [k, v] of Object.entries(rest)) { const s = String(v ?? "").trim(); if (s) config[k] = s; }
  return { name: name.trim(), config };
};

function ConnectStep({ type, onBack, onClose, onSaved }) {
  const t = TYPES[type];
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); nameRef.current?.select(); }, []); // the modal only focuses on open, not on a step change
  const initial = { name: `My ${t.label}`, ...Object.fromEntries(t.fields.map((f) => [f.key, ""])) };
  const [live, setLive] = useState(() => JSON.stringify(initial));
  // the result of the last test and the exact values it was run with
  const [test, setTest] = useState(null); // { snapshot, ok, text }
  const [testing, setTesting] = useState(false), [saving, setSaving] = useState(false), [saveErr, setSaveErr] = useState("");
  const form = useForm({
    mode: "uncontrolled",
    initialValues: initial,
    validate: { name: isNotEmpty("Give it a name"), ...Object.fromEntries(t.fields.filter((f) => f.required).map((f) => [f.key, isNotEmpty(`${f.label} is required`)])) },
    onValuesChange: (values) => setLive(JSON.stringify(values)),
  });
  const current = test && test.snapshot === live ? test : null; // any edit invalidates a test
  const canSave = !!current?.ok;

  const runTest = async (values) => {
    const snapshot = JSON.stringify(values);
    setTesting(true); setSaveErr("");
    try {
      const d = await postJson("/connections/test", { type, ...clean(values) });
      setTest({ snapshot, ok: true, text: `Connected. Found ${plural(d.containers ?? 0, t.noun, t.nouns)}.` });
    } catch (e) {
      setTest({ snapshot, ok: false, text: e.message });
    } finally { setTesting(false); }
  };
  const save = async (values) => {
    setSaving(true); setSaveErr("");
    try {
      const d = await postJson("/connections", { type, ...clean(values) });
      onSaved?.(d.connection);
      onClose();
    } catch (e) { setSaveErr(e.message); } finally { setSaving(false); }
  };
  // Enter does the next step: save when this exact setup has passed a test, otherwise test it
  const submit = form.onSubmit((values) => (canSave ? save(values) : runTest(values)));

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <TypeIcon type={type} size={36} />
          <Box><Text fw={600}>{t.label}</Text><Text size="sm" c="dimmed">{t.blurb}</Text></Box>
        </Group>
        <TextInput ref={nameRef} label="Name" withAsterisk key={form.key("name")} {...form.getInputProps("name")} autoComplete="off" />
        {t.fields.map((f) => {
          const Input = f.secret ? PasswordInput : TextInput;
          return (
            <Input key={f.key} label={f.label} placeholder={f.placeholder} withAsterisk={!!f.required} autoComplete="off" spellCheck={false}
              {...form.getInputProps(f.key)} />
          );
        })}
        <Box aria-live="polite" mih={testing || current || saveErr ? undefined : 0}>
          {testing && <Text size="sm" c="dimmed">Testing…</Text>}
          {!testing && current && (
            <Alert color={current.ok ? "teal" : "red"} icon={current.ok ? <IconCircleCheck size={18} /> : <IconAlertCircle size={18} />} title={current.ok ? "Test passed" : "Could not connect"}>{current.text}</Alert>
          )}
          {!testing && !current && test && <Text size="sm" c="dimmed">You changed something. Test the connection again before saving.</Text>}
          {saveErr && <Alert mt="xs" color="red" icon={<IconAlertCircle size={18} />} title="Could not save">{saveErr}</Alert>}
        </Box>
        <Group justify="space-between" wrap="wrap">
          <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>Back</Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button variant="light" type={canSave ? "button" : "submit"} loading={testing} onClick={canSave ? () => { if (!form.validate().hasErrors) runTest(form.getValues()); } : undefined}>Test connection</Button>
            <Button type={canSave ? "submit" : "button"} disabled={!canSave} loading={saving}>Save</Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

export default function AddDataModal({ opened, onClose, onSaved }) {
  const [type, setType] = useState(null);
  useEffect(() => { if (opened) setType(null); }, [opened]);
  return (
    <Modal opened={opened} onClose={onClose} size="lg" title={<Text fw={600}>{type ? `Connect ${TYPES[type].label}` : "Add data"}</Text>} trapFocus returnFocus>
      {type ? <ConnectStep key={type} type={type} onBack={() => setType(null)} onClose={onClose} onSaved={onSaved} /> : <TypeStep onPick={setType} />}
    </Modal>
  );
}
