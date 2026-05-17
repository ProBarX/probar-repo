"use client"

import type { CSSProperties, FormEvent, ReactNode } from "react"
import {
  AlertCircle,
  CalendarDays,
  Clock,
  FileText,
  Hash,
  Loader2,
  MapPin,
  Save,
  Type,
  Users,
} from "lucide-react"
import {
  formDateToInput,
  inputDateToForm,
  type EventoForm,
  type EventoFormErrors,
} from "@/services/useEvent"

type Props = {
  form: EventoForm
  errors: EventoFormErrors
  errorMessage?: string | null
  title: string
  description: string
  submitLabel: string
  saving: boolean
  onChange: (field: keyof EventoForm, value: string | boolean) => void
  onSubmit: () => void
}

export function EventForm({
  form,
  errors,
  errorMessage,
  title,
  description,
  submitLabel,
  saving,
  onChange,
  onSubmit,
}: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit()
  }

  function toggleSemNumero() {
    const next = !form.semNumero
    onChange("semNumero", next)
    if (next) onChange("numero", "")
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={formStyle}>
      <section style={panelStyle}>
        <div style={headingStyle}>
          <h1 style={titleStyle}>{title}</h1>
          <p style={descriptionStyle}>{description}</p>
        </div>

        {errorMessage && <FormNotice message={errorMessage} />}

        <div style={sectionHeaderStyle}>
          <MapPin size={18} />
          <h2 style={sectionTitleStyle}>Local do evento</h2>
        </div>

        <div style={gridStyle}>
          <Field label="CEP" fieldError={errors.cep} icon={<MapPin size={15} />}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="01000000"
              value={form.cep}
              onChange={(event) => onChange("cep", event.target.value)}
              style={inputStyle(Boolean(errors.cep))}
            />
          </Field>

          <Field label="Rua / Avenida" fieldError={errors.rua} icon={<MapPin size={15} />}>
            <input
              type="text"
              placeholder="Av. Paulista"
              value={form.rua}
              onChange={(event) => onChange("rua", event.target.value)}
              style={inputStyle(Boolean(errors.rua))}
            />
          </Field>

          <Field label="Numero" fieldError={errors.numero} icon={<Hash size={15} />}>
            <div style={numberFieldStyle}>
              <input
                type="text"
                placeholder="1000"
                value={form.numero}
                disabled={form.semNumero}
                onChange={(event) => onChange("numero", event.target.value)}
                style={{
                  ...inputStyle(Boolean(errors.numero)),
                  opacity: form.semNumero ? 0.55 : 1,
                  paddingRight: "132px",
                }}
              />
              <button
                type="button"
                aria-pressed={form.semNumero}
                onClick={toggleSemNumero}
                style={switchWrapperStyle}
              >
                <span style={switchLabelStyle}>Sem numero</span>
                <span
                  style={{
                    ...switchTrackStyle,
                    background: form.semNumero ? "#F5C518" : "#D1D5DB",
                  }}
                >
                  <span
                    style={{
                      ...switchThumbStyle,
                      transform: form.semNumero ? "translateX(12px)" : "translateX(0)",
                    }}
                  />
                </span>
              </button>
            </div>
          </Field>

          <Field label="Complemento" icon={<Hash size={15} />}>
            <input
              type="text"
              placeholder="Apto, sala, bloco"
              value={form.complemento}
              onChange={(event) => onChange("complemento", event.target.value)}
              style={inputStyle(false)}
            />
          </Field>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <CalendarDays size={18} />
          <h2 style={sectionTitleStyle}>Detalhes</h2>
        </div>

        <div style={gridStyle}>
          <Field label="Nome do evento" fieldError={errors.nome} icon={<Type size={15} />}>
            <input
              type="text"
              placeholder="Conexao Digital"
              value={form.nome}
              onChange={(event) => onChange("nome", event.target.value)}
              style={inputStyle(Boolean(errors.nome))}
            />
          </Field>

          <Field label="Quantidade de pessoas" fieldError={errors.quantidade} icon={<Users size={15} />}>
            <input
              type="number"
              min={1}
              placeholder="150"
              value={form.quantidade}
              onChange={(event) => onChange("quantidade", event.target.value)}
              style={inputStyle(Boolean(errors.quantidade))}
            />
          </Field>

          <Field label="Data" fieldError={errors.data} icon={<CalendarDays size={15} />}>
            <input
              type="date"
              value={formDateToInput(form.data)}
              onChange={(event) => onChange("data", inputDateToForm(event.target.value))}
              style={inputStyle(Boolean(errors.data))}
            />
          </Field>

          <div style={timeGridStyle}>
            <Field label="Inicio" fieldError={errors.horarioInicio} icon={<Clock size={15} />}>
              <input
                type="time"
                value={form.horarioInicio}
                onChange={(event) => onChange("horarioInicio", event.target.value)}
                style={inputStyle(Boolean(errors.horarioInicio))}
              />
            </Field>

            <Field label="Fim" fieldError={errors.horarioFim} icon={<Clock size={15} />}>
              <input
                type="time"
                value={form.horarioFim}
                onChange={(event) => onChange("horarioFim", event.target.value)}
                style={inputStyle(Boolean(errors.horarioFim))}
              />
            </Field>
          </div>

          <div style={wideFieldStyle}>
            <Field label="Descricao do evento" icon={<FileText size={15} />}>
              <textarea
                maxLength={128}
                placeholder="Conte um pouco sobre o evento e o perfil do publico"
                value={form.descricao}
                onChange={(event) => onChange("descricao", event.target.value)}
                style={{ ...inputStyle(false), minHeight: 104, padding: 12, resize: "vertical" }}
              />
              <span style={counterStyle}>{form.descricao.length}/128</span>
            </Field>
          </div>
        </div>
      </section>

      <div style={actionsStyle}>
        <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  icon,
  fieldError,
  children,
}: {
  label: string
  icon: ReactNode
  fieldError?: string
  children: ReactNode
}) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>
        <span style={labelIconStyle}>{icon}</span>
        {label}
      </span>
      {children}
      {fieldError && <span style={fieldErrorStyle}>{fieldError}</span>}
    </label>
  )
}

function FormNotice({ message }: { message: string }) {
  return (
    <div role="alert" style={noticeStyle}>
      <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  )
}

const formStyle: CSSProperties = {
  display: "grid",
  gap: 16,
}

const panelStyle: CSSProperties = {
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  background: "#fff",
  padding: 24,
  display: "grid",
  gap: 18,
  minWidth: 0,
  boxSizing: "border-box",
}

const headingStyle: CSSProperties = {
  display: "grid",
  gap: 6,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 800,
}

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#6B7280",
  fontSize: 14,
  lineHeight: 1.5,
}

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#111827",
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.25,
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 14,
  minWidth: 0,
}

const timeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
  gap: 12,
  minWidth: 0,
}

const wideFieldStyle: CSSProperties = {
  gridColumn: "1 / -1",
}

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#6B7280",
  fontSize: 13,
  fontWeight: 700,
}

const labelIconStyle: CSSProperties = {
  color: "#8A6D00",
  display: "inline-flex",
}

function inputStyle(hasError: boolean): CSSProperties {
  return {
    width: "100%",
    minHeight: 44,
    border: hasError ? "1px solid #FCA5A5" : "1px solid #D1D5DB",
    borderRadius: 8,
    background: "#fff",
    color: "#111827",
    font: "inherit",
    fontSize: 14,
    outline: "none",
    padding: "0 12px",
    boxSizing: "border-box",
  }
}

const numberFieldStyle: CSSProperties = {
  position: "relative",
  minWidth: 0,
}

const switchWrapperStyle: CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "none",
  background: "transparent",
  color: "#6B7280",
  cursor: "pointer",
  padding: 0,
}

const switchLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
}

const switchTrackStyle: CSSProperties = {
  width: 28,
  height: 16,
  borderRadius: 999,
  padding: 2,
  boxSizing: "border-box",
  transition: "background 160ms ease",
}

const switchThumbStyle: CSSProperties = {
  display: "block",
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#fff",
  transition: "transform 160ms ease",
}

const fieldErrorStyle: CSSProperties = {
  color: "#B91C1C",
  fontSize: 12,
  lineHeight: 1.35,
}

const counterStyle: CSSProperties = {
  justifySelf: "end",
  color: "#9CA3AF",
  fontSize: 12,
}

const noticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  color: "#991B1B",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
}

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    minWidth: 176,
    border: "none",
    borderRadius: 8,
    background: disabled ? "#D1D5DB" : "#F5C518",
    color: "#111827",
    cursor: disabled ? "wait" : "pointer",
    fontWeight: 800,
    fontSize: 15,
    padding: "0 16px",
  }
}
