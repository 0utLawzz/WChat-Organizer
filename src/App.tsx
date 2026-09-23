import { useEffect, useState } from "react";

const AUTH_KEY = "marque-nb-auth";
const APP_PASSWORD = "brandex2026";

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1",
  );
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  if (authed) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 560 }}>
        <h1>BrandEx Workspace</h1>
        <p>
          Production <code>App.tsx</code> needs a re-upload (automated push of the
          ~108KB file hit a size limit).
        </p>
        <ol>
          <li>
            Download the production file from the chat (App.tsx.production).
          </li>
          <li>
            Open{" "}
            <a href="https://github.com/0utLawzz/WChat-Organizer/upload/main/src">
              github.com/0utLawzz/WChat-Organizer/upload/main/src
            </a>
          </li>
          <li>
            Drop the file, name it <code>App.tsx</code>, commit message:
            <br />
            <code>ui: Database Store structured cards instead of raw JSON</code>
          </li>
        </ol>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(AUTH_KEY);
            setAuthed(false);
          }}
          style={{ marginTop: 16, padding: "8px 16px" }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#F0E8D0",
        fontFamily: "system-ui",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === APP_PASSWORD) {
            sessionStorage.setItem(AUTH_KEY, "1");
            setAuthed(true);
          } else setError("Incorrect password");
        }}
        style={{
          background: "#FAF6EE",
          border: "3px solid #0C0C0C",
          boxShadow: "5px 5px 0 #0C0C0C",
          padding: 32,
          width: 360,
        }}
      >
        <h1 style={{ marginTop: 0 }}>BRANDEX.</h1>
        <p style={{ opacity: 0.6, fontSize: 14 }}>Enter password to unlock</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError("");
          }}
          placeholder="Password"
          style={{
            width: "100%",
            padding: 10,
            border: "2px solid #0C0C0C",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
          autoFocus
        />
<<<<<<< HEAD
        <button className="nb-btn" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> UPLOAD
        </button>
        <button
          className="nb-btn nb-btn-secondary"
          onClick={onLogout}
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </header>

      <div className="nb-tabs">
        <button
          className={`nb-tab ${activeTab === "messages" ? "active" : ""}`}
          onClick={() => setActiveTab("messages")}
        >
          Messages
        </button>
        <button
          className={`nb-tab ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          Daily Work
        </button>
        <button
          className={`nb-tab ${activeTab === "todos" ? "active" : ""}`}
          onClick={() => setActiveTab("todos")}
        >
          To-Dos ({openTodos.length})
        </button>
        <button
          className={`nb-tab ${activeTab === "progress" ? "active" : ""}`}
          onClick={() => setActiveTab("progress")}
        >
          Progress & Memory
        </button>
        <button
          className={`nb-tab ${activeTab === "backup" ? "active" : ""}`}
          onClick={() => setActiveTab("backup")}
        >
          Backup & Sync
          {dbStatus === "connected" && (
            <span className="ml-1 inline-block size-2 rounded-full bg-teal-600" title="DB connected" />
          )}
          {dbStatus === "error" && (
            <span className="ml-1 inline-block size-2 rounded-full bg-orange-600" title="DB error" />
          )}
          {dbStatus === "connecting" && (
            <span className="ml-1 inline-block size-2 rounded-full bg-yellow-500 animate-pulse" title="Connecting…" />
          )}
        </button>
        <button
          className={`nb-tab ${activeTab === "db" ? "active" : ""}`}
          onClick={() => setActiveTab("db")}
        >
          Database
        </button>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-5 px-4 py-5 lg:px-6">
        <aside className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Quick
            </div>
            <div className="flex flex-col gap-1">
              <FilterChip
                active={!activeSender && !showSavedOnly && !activeLabel && !activeType}
                onClick={() => {
                  setActiveSender(null);
                  setShowSavedOnly(false);
                  setActiveLabel(null);
                  setActiveType(null);
                }}
              >
                All
              </FilterChip>
              <FilterChip
                active={showSavedOnly}
                onClick={() => {
                  setShowSavedOnly(!showSavedOnly);
                  setActiveSender(null);
                }}
              >
                <Bookmark size={12} /> Saved
              </FilterChip>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Types
            </div>
            <div className="flex flex-col gap-1">
              {persisted.types.map((type) => {
                const c = CHIP_COLORS[type.color] ?? CHIP_COLORS.orange!;
                return (
                  <FilterChip
                    key={type.id}
                    active={activeType === type.id}
                    onClick={() =>
                      setActiveType(activeType === type.id ? null : type.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {type.name}
                  </FilterChip>
                );
              })}
            </div>
            <div className="mt-3 flex gap-1">
              <input
                className="nb-input text-xs"
                placeholder="New type…"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addNamed("types", newTypeName, () => setNewTypeName(""))
                }
              />
              <button
                className="nb-btn nb-btn-secondary px-2"
                onClick={() =>
                  addNamed("types", newTypeName, () => setNewTypeName(""))
                }
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Labels
            </div>
            <div className="flex flex-col gap-1">
              {persisted.labels.map((label) => {
                const c = CHIP_COLORS[label.color] ?? CHIP_COLORS.orange!;
                return (
                  <FilterChip
                    key={label.id}
                    active={activeLabel === label.id}
                    onClick={() =>
                      setActiveLabel(activeLabel === label.id ? null : label.id)
                    }
                  >
                    <span
                      className="inline-block size-2.5 rounded-sm"
                      style={{ background: c.border }}
                    />
                    {label.name}
                  </FilterChip>
                );
              })}
            </div>
            <div className="mt-3 flex gap-1">
              <input
                className="nb-input text-xs"
                placeholder="New label…"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addNamed("labels", newLabelName, () => setNewLabelName(""))
                }
              />
              <button
                className="nb-btn nb-btn-secondary px-2"
                onClick={() =>
                  addNamed("labels", newLabelName, () => setNewLabelName(""))
                }
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div className="nb-panel p-3">
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Chats
            </div>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {senders.slice(0, 20).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <FilterChip
                    active={activeSender === s}
                    onClick={() =>
                      setActiveSender(activeSender === s ? null : s)
                    }
                  >
                    <span
                      className="grid size-5 place-items-center rounded-sm text-[9px] font-bold text-white"
                      style={{ background: avatarColor(s) }}
                    >
                      {initials(displaySender(s))}
                    </span>
                    <span className="truncate max-w-[90px]">
                      {displaySender(s)}
                    </span>
                  </FilterChip>
                  <button
                    title="Rename"
                    className="opacity-40 hover:opacity-100 text-[10px] px-1"
                    onClick={() => renameSender(s)}
                  >
                    ✎
                  </button>
                  <button
                    title="Remove chat"
                    className="opacity-40 hover:opacity-100"
                    onClick={() => removeSender(s)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Progress & Memory widget */}
          <div className="nb-panel p-3">
            <div
              className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider opacity-50"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span>Progress</span>
              <button
                className="opacity-60 hover:opacity-100 normal-case tracking-normal"
                onClick={() => setActiveTab("progress")}
              >
                Open →
              </button>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {persisted.journal.slice(0, 4).map((j) => (
                <div key={j.id} className="text-[11px] leading-snug">
                  <span
                    className="nb-badge text-[9px] uppercase mr-1"
                    style={{
                      borderColor:
                        j.kind === "progress"
                          ? "#0D9970"
                          : j.kind === "memory"
                            ? "#8B2FC9"
                            : "#C94A00",
                      color:
                        j.kind === "progress"
                          ? "#0D9970"
                          : j.kind === "memory"
                            ? "#8B2FC9"
                            : "#C94A00",
                    }}
                  >
                    {j.kind}
                  </span>
                  <span className="opacity-80 line-clamp-2">{j.text}</span>
                </div>
              ))}
              {persisted.journal.length === 0 && (
                <p className="text-[11px] opacity-40">No entries yet</p>
              )}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {activeTab === "messages" && (
            <div className="nb-panel min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-black/10 px-4 py-3">
                  <Search size={16} className="opacity-40" />
                  <input
                    className="min-w-[140px] flex-1 border-none bg-transparent text-sm outline-none"
                    style={{ fontFamily: "var(--font-body)" }}
                    placeholder="Search messages, senders…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] uppercase tracking-wider opacity-50"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Per page
                    </span>
                    {([100, 250] as const).map((n) => (
                      <button
                        key={n}
                        className="px-2 py-1 text-xs"
                        style={{
                          fontFamily: "var(--font-mono)",
                          border: "2px solid #0C0C0C",
                          background:
                            pageSize === n ? "var(--accent)" : "var(--panel)",
                          color: pageSize === n ? "#fff" : "var(--black)",
                        }}
                        onClick={() =>
                          setPersisted((p) => ({ ...p, pageSize: n }))
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-sm opacity-50">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-12 text-center">
                    <div
                      className="nb-stamp nb-stamp-yellow mb-3"
                      style={{ transform: "rotate(3deg)" }}
                    >
                      EMPTY
                    </div>
                    <p className="text-sm opacity-60">
                      {messages.length === 0
                        ? "No dummy data. Click UPLOAD and choose a WhatsApp .txt or .zip export."
                        : "No messages match the current filters."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                      {Array.from(groups.entries()).map(([date, msgs]) => (
                        <div key={date}>
                          <div
                            className="sticky top-0 z-10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                            style={{
                              background: "var(--bg-alt)",
                              borderBottom: "2px solid rgba(12,12,12,0.1)",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {formatGroupDate(msgs[0]?.timestamp ?? 0)}
                          </div>
                          {msgs.map((m) => (
                            <MessageRow
                              key={m.id}
                              message={m}
                              labels={persisted.labels}
                              types={persisted.types}
                              assignedLabels={persisted.messageLabels[m.id] ?? []}
                              assignedTypes={persisted.messageTypes[m.id] ?? []}
                              saved={persisted.savedIds.includes(m.id)}
                              labelPickerOpen={labelPickerFor === m.id}
                              typePickerOpen={typePickerFor === m.id}
                              onToggleSave={() => toggleSave(m.id)}
                              onToggleLabel={(id) => {
                                toggleOnMessage("messageLabels", m.id, id);
                                setLabelPickerFor(null);
                              }}
                              onToggleType={(id) => {
                                toggleOnMessage("messageTypes", m.id, id);
                                setTypePickerFor(null);
                              }}
                              onOpenLabelPicker={() => {
                                setLabelPickerFor(
                                  labelPickerFor === m.id ? null : m.id,
                                );
                                setTypePickerFor(null);
                              }}
                              onOpenTypePicker={() => {
                                setTypePickerFor(
                                  typePickerFor === m.id ? null : m.id,
                                );
                                setLabelPickerFor(null);
                              }}
                              onAddTodo={() => addTodo(m.text.slice(0, 120), m.id)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-black/10 px-4 py-3">
                      <span
                        className="text-xs uppercase tracking-wider opacity-60"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {rangeStart}–{rangeEnd} of {filtered.length}
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="nb-btn nb-btn-secondary"
                          disabled={safePage <= 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>
                        <span
                          className="grid place-items-center px-2 text-xs"
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          {safePage + 1} / {totalPages}
                        </span>
                        <button
                          className="nb-btn nb-btn-secondary"
                          disabled={safePage >= totalPages - 1}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages - 1, p + 1))
                          }
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
          )}

          {activeTab === "daily" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                DAILY WORK PREVIEW
              </h2>
              <p className="mb-4 text-sm opacity-60">
                Overview of messages, open to-dos, and journal entries by day.
                Select a date to focus, or view all days with activity.
              </p>

              {(() => {
                const byDate = groupByDate(messages);
                const dayKeys = Array.from(byDate.keys()).sort((a, b) => {
                  // Sort chronologically using first message timestamp of each day
                  const ta = byDate.get(a)?.[0]?.timestamp ?? 0;
                  const tb = byDate.get(b)?.[0]?.timestamp ?? 0;
                  return tb - ta; // newest first
                });
                const focusKey =
                  selectedDay && byDate.has(selectedDay)
                    ? selectedDay
                    : dayKeys[0] ?? null;

                const dayMessages = focusKey ? byDate.get(focusKey) ?? [] : [];
                // Show open todos + any with an explicit due date (date strings vary by locale)
                const dayTodos = persisted.todos.filter((t) => {
                  if (t.done) return false;
                  if (t.period === "today" || t.period === "this_week") return true;
                  if (t.dueDate) return true;
                  // Include recently created (last 48 h) when viewing the newest day
                  if (focusKey === dayKeys[0] && Date.now() - t.createdAt < 48 * 60 * 60 * 1000)
                    return true;
                  return false;
                });
                const dayJournal = focusKey
                  ? persisted.journal.filter((j) => {
                      const msgTs = dayMessages[0]?.timestamp;
                      if (!msgTs) return false;
                      const dayStart = new Date(msgTs);
                      dayStart.setHours(0, 0, 0, 0);
                      const dayEnd = new Date(dayStart);
                      dayEnd.setDate(dayEnd.getDate() + 1);
                      return j.createdAt >= dayStart.getTime() && j.createdAt < dayEnd.getTime();
                    })
                  : [];

                return (
                  <>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {dayKeys.length === 0 && (
                        <p className="text-sm opacity-50">
                          Upload a chat export to see daily breakdowns.
                        </p>
                      )}
                      {dayKeys.slice(0, 14).map((key) => {
                        const count = byDate.get(key)?.length ?? 0;
                        const isFocus = key === focusKey;
                        return (
                          <button
                            key={key}
                            className={`nb-btn ${isFocus ? "" : "nb-btn-secondary"} text-xs`}
                            onClick={() => setSelectedDay(key)}
                          >
                            <Calendar size={12} /> {key} ({count})
                          </button>
                        );
                      })}
                      {dayKeys.length > 14 && (
                        <span className="text-xs opacity-50 self-center">
                          +{dayKeys.length - 14} more days
                        </span>
                      )}
                    </div>

                    {focusKey && (
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <MessageSquare size={16} style={{ color: "var(--accent)" }} />
                            <span className="font-medium">Messages</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayMessages.length}
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayMessages.slice(0, 30).map((m) => (
                              <div key={m.id} className="border-b border-black/5 pb-1">
                                <span className="text-[11px] opacity-50" style={{ fontFamily: "var(--font-mono)" }}>
                                  {m.time}
                                </span>{" "}
                                <strong>{m.sender ?? "System"}</strong>
                                <div className="truncate opacity-80">{m.isMedia ? "📎 Media" : m.text}</div>
                              </div>
                            ))}
                            {dayMessages.length > 30 && (
                              <p className="text-xs opacity-50">…and {dayMessages.length - 30} more</p>
                            )}
                            {dayMessages.length === 0 && (
                              <p className="text-xs opacity-50">No messages this day.</p>
                            )}
                          </div>
                        </div>

                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <ListTodo size={16} style={{ color: "var(--accent2)" }} />
                            <span className="font-medium">To-Dos</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayTodos.filter((t) => !t.done).length} open
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayTodos.length === 0 && (
                              <p className="text-xs opacity-50">No to-dos linked to this day.</p>
                            )}
                            {dayTodos.map((t) => (
                              <div
                                key={t.id}
                                className={`flex items-start gap-2 ${t.done ? "opacity-50 line-through" : ""}`}
                              >
                                <button onClick={() => toggleTodo(t.id)} className="mt-0.5">
                                  {t.done ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                                <div>
                                  <div>{t.text}</div>
                                  {(t.dueDate || t.priority) && (
                                    <div className="text-[11px] opacity-50">
                                      {t.dueDate && `Due ${t.dueDate}`}
                                      {t.priority && ` · ${t.priority}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div
                          className="p-4"
                          style={{
                            border: "3px solid #0C0C0C",
                            boxShadow: "4px 4px 0 #0C0C0C",
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Activity size={16} style={{ color: "var(--accent3)" }} />
                            <span className="font-medium">Journal</span>
                            <span className="ml-auto text-xs opacity-50">
                              {dayJournal.length}
                            </span>
                          </div>
                          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                            {dayJournal.length === 0 && (
                              <p className="text-xs opacity-50">No journal entries this day.</p>
                            )}
                            {dayJournal.map((j) => (
                              <div key={j.id} className="border-b border-black/5 pb-1">
                                <span className="nb-badge text-[10px] uppercase mr-1">{j.kind}</span>
                                {j.text}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {!focusKey && messages.length === 0 && (
                      <div className="py-8 text-center text-sm opacity-50">
                        Upload a WhatsApp .txt or .zip export to populate the daily preview.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === "todos" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-4 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                TO-DOS {editingTodoId ? "· Editing" : ""}
              </h2>
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="nb-input min-w-[200px] flex-1"
                    placeholder={editingTodoId ? "Edit to-do…" : "Add a to-do…"}
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTodo(newTodoText)}
                  />
                  <button className="nb-btn" onClick={() => addTodo(newTodoText)}>
                    <Plus size={14} /> {editingTodoId ? "Save" : "Add"}
                  </button>
                  {editingTodoId && (
                    <button className="nb-btn nb-btn-secondary" onClick={resetTodoForm}>
                      Cancel
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Due date
                    </span>
                    <input
                      type="date"
                      className="nb-input text-xs"
                      value={newTodoDueDate}
                      onChange={(e) => setNewTodoDueDate(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Time
                    </span>
                    <input
                      type="time"
                      className="nb-input text-xs"
                      value={newTodoDueTime}
                      onChange={(e) => setNewTodoDueTime(e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span>Period</span>
                    <select
                      className="nb-input text-xs"
                      value={newTodoPeriod}
                      onChange={(e) =>
                        setNewTodoPeriod(e.target.value as Todo["period"])
                      }
                    >
                      <option value="none">No period</option>
                      <option value="today">Today</option>
                      <option value="this_week">This week</option>
                      <option value="this_month">This month</option>
                      <option value="later">Later</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1">
                      <Flag size={12} /> Priority
                    </span>
                    <select
                      className="nb-input text-xs"
                      value={newTodoPriority}
                      onChange={(e) =>
                        setNewTodoPriority(e.target.value as Todo["priority"])
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
                <input
                  className="nb-input text-xs"
                  placeholder="Notes (optional)…"
                  value={newTodoNotes}
                  onChange={(e) => setNewTodoNotes(e.target.value)}
                />
                {/* Labels (tags) — separate from Types */}
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider opacity-50 flex items-center gap-1">
                    <Tag size={11} /> Labels
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {persisted.labels.map((l) => {
                      const on = newTodoLabelIds.includes(l.id);
                      const c = CHIP_COLORS[l.color] ?? CHIP_COLORS.orange!;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="nb-badge text-[11px]"
                          style={{
                            borderColor: c.border,
                            color: on ? "#fff" : c.text,
                            background: on ? c.border : c.bg,
                          }}
                          onClick={() =>
                            setNewTodoLabelIds((ids) =>
                              on ? ids.filter((x) => x !== l.id) : [...ids, l.id],
                            )
                          }
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Types (work categories) — separate from Labels */}
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wider opacity-50 flex items-center gap-1">
                    <Layers size={11} /> Types
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {persisted.types.map((ty) => {
                      const on = newTodoTypeIds.includes(ty.id);
                      const c = CHIP_COLORS[ty.color] ?? CHIP_COLORS.orange!;
                      return (
                        <button
                          key={ty.id}
                          type="button"
                          className="nb-badge text-[11px]"
                          style={{
                            borderColor: c.border,
                            color: on ? "#fff" : c.text,
                            background: on ? c.border : c.bg,
                          }}
                          onClick={() =>
                            setNewTodoTypeIds((ids) =>
                              on ? ids.filter((x) => x !== ty.id) : [...ids, ty.id],
                            )
                          }
                        >
                          {ty.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {persisted.todos.length === 0 && (
                  <p className="text-sm opacity-50">No to-dos yet.</p>
                )}
                {persisted.todos.map((t) => {
                  const priorityColor =
                    t.priority === "high"
                      ? "#C94A00"
                      : t.priority === "low"
                        ? "#0D9970"
                        : "#D4A800";
                  return (
                    <div
                      key={t.id}
                      className="flex items-start gap-3 border-2 border-black/10 p-3"
                      style={{
                        background: t.done ? "var(--bg-alt)" : "var(--panel)",
                        opacity: t.done ? 0.65 : 1,
                      }}
                    >
                      <button onClick={() => toggleTodo(t.id)} className="mt-0.5">
                        {t.done ? (
                          <CheckSquare
                            size={18}
                            style={{ color: "var(--accent2)" }}
                          />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-sm"
                          style={{
                            textDecoration: t.done ? "line-through" : "none",
                          }}
                        >
                          {t.text}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] opacity-60">
                          {t.priority && t.priority !== "medium" && (
                            <span
                              className="nb-badge"
                              style={{
                                borderColor: priorityColor,
                                color: priorityColor,
                                background: `${priorityColor}18`,
                              }}
                            >
                              {t.priority}
                            </span>
                          )}
                          {t.period && t.period !== "none" && (
                            <span className="nb-badge">
                              {t.period.replace("_", " ")}
                            </span>
                          )}
                          {(t.dueDate || t.dueTime) && (
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {[t.dueDate, t.dueTime].filter(Boolean).join(" · ")}
                            </span>
                          )}
                          {(t.labelIds ?? []).map((lid) => {
                            const l = persisted.labels.find((x) => x.id === lid);
                            if (!l) return null;
                            const c = CHIP_COLORS[l.color] ?? CHIP_COLORS.orange!;
                            return (
                              <span
                                key={lid}
                                className="nb-badge"
                                style={{
                                  borderColor: c.border,
                                  color: c.text,
                                  background: c.bg,
                                }}
                              >
                                {l.name}
                              </span>
                            );
                          })}
                          {(t.typeIds ?? []).map((tid) => {
                            const ty = persisted.types.find((x) => x.id === tid);
                            if (!ty) return null;
                            const c = CHIP_COLORS[ty.color] ?? CHIP_COLORS.orange!;
                            return (
                              <span
                                key={tid}
                                className="nb-badge"
                                style={{
                                  borderColor: c.border,
                                  color: c.text,
                                  background: c.bg,
                                }}
                              >
                                {ty.name}
                              </span>
                            );
                          })}
                          {t.notes && (
                            <span className="italic opacity-80">{t.notes}</span>
                          )}
                        </div>
                      </div>
                      <button
                        title="Edit"
                        onClick={() => startEditTodo(t)}
                        className="opacity-40 hover:opacity-100 mr-1"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeTodo(t.id)}
                        className="opacity-40 hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "progress" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                PROGRESS & MEMORY
              </h2>
              <p className="mb-4 text-sm opacity-60">
                Log progress updates and agent memory notes. Synced with local
                desk state and Supabase backup.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <select
                  className="nb-input w-auto text-xs"
                  value={newJournalKind}
                  onChange={(e) =>
                    setNewJournalKind(e.target.value as JournalEntry["kind"])
                  }
                >
                  <option value="progress">Progress</option>
                  <option value="memory">Memory</option>
                  <option value="note">Note</option>
                </select>
                <input
                  className="nb-input min-w-[200px] flex-1"
                  placeholder="What happened / what to remember…"
                  value={newJournalText}
                  onChange={(e) => setNewJournalText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addJournalEntry()}
                />
                <button className="nb-btn" onClick={addJournalEntry}>
                  <Plus size={14} /> Log
                </button>
              </div>
              <div className="space-y-2">
                {persisted.journal.length === 0 && (
                  <p className="text-sm opacity-50">
                    No progress or memory entries yet.
                  </p>
                )}
                {persisted.journal.map((j) => {
                  const kindIcon =
                    j.kind === "progress" ? (
                      <Activity size={14} />
                    ) : j.kind === "memory" ? (
                      <Brain size={14} />
                    ) : (
                      <MessageSquare size={14} />
                    );
                  const kindColor =
                    j.kind === "progress"
                      ? "#0D9970"
                      : j.kind === "memory"
                        ? "#8B2FC9"
                        : "#C94A00";
                  return (
                    <div
                      key={j.id}
                      className="flex items-start gap-3 border-2 border-black/10 p-3"
                    >
                      <span style={{ color: kindColor }} className="mt-0.5">
                        {kindIcon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                          <span
                            className="nb-badge text-[10px] uppercase"
                            style={{
                              borderColor: kindColor,
                              color: kindColor,
                              background: `${kindColor}15`,
                            }}
                          >
                            {j.kind}
                          </span>
                          <span
                            className="text-[11px] opacity-40"
                            style={{ fontFamily: "var(--font-mono)" }}
                          >
                            {new Date(j.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm leading-snug">{j.text}</p>
                      </div>
                      <button
                        onClick={() => removeJournalEntry(j.id)}
                        className="opacity-40 hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "backup" && (
            <div className="nb-panel p-6">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                BACKUP & SYNC
              </h2>
              {syncNote && (
                <p className="mb-4 text-sm" style={{ color: "var(--accent4)" }}>
                  {syncNote}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  className="p-5"
                  style={{
                    border: "3px solid #0C0C0C",
                    boxShadow: "5px 5px 0 #0C0C0C",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet size={20} style={{ color: "var(--accent2)" }} />
                    <span className="font-medium">Google Sheets</span>
                  </div>
                  <p className="mb-2 text-xs opacity-60">
                    <strong>Sheet URL</strong> — your Google Spreadsheet. Default
                    BrandEx sheet is pre-filled.{" "}
                    <a
                      href="https://docs.google.com/spreadsheets/d/1PyvUTN9zR3kgcYIjhZu1inXoX0ZsIvD2SSo1yxrZ26o/edit?gid=307425405"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      style={{ color: "var(--accent2)" }}
                    >
                      Open default sheet ↗
                    </a>
                  </p>
                  <p className="mb-3 text-xs opacity-60">
                    <strong>Webhook</strong> — optional Apps Script web-app URL.
                    Without it, Sync downloads CSV + opens the sheet for File →
                    Import. With a webhook, Sync POSTs CSV for one-click append.
                    Create via Extensions → Apps Script → deploy as web app
                    (anyone, execute as you).
                  </p>
                  <input
                    className="nb-input mb-3 text-xs"
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    value={persisted.googleSheetUrl}
                    onChange={(e) =>
                      setPersisted((p) => ({
                        ...p,
                        googleSheetUrl: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="nb-input mb-3 text-xs"
                    placeholder="Apps Script webhook URL (optional, for direct push)"
                    value={persisted.googleWebhookUrl}
                    onChange={(e) =>
                      setPersisted((p) => ({
                        ...p,
                        googleWebhookUrl: e.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-col gap-2">
                    <button className="nb-btn nb-btn-teal w-full" onClick={syncGoogleSheet}>
                      <RefreshCw size={14} /> Sync to Sheet
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={() => {
                        const url = sheetEditUrl(persisted.googleSheetUrl);
                        if (url) window.open(url, "_blank", "noopener,noreferrer");
                        else setSyncNote("Paste a Google Sheet link first.");
                      }}
                    >
                      <ExternalLink size={14} /> Open Sheet
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={pullPublishedSheet}
                    >
                      <Download size={14} /> Pull published CSV
                    </button>
                  </div>
                  {extractSheetId(persisted.googleSheetUrl) && (
                    <p
                      className="mt-2 truncate text-[10px] opacity-50"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      ID {extractSheetId(persisted.googleSheetUrl)}
                    </p>
                  )}
                </div>

                <div
                  className="p-5"
                  style={{
                    border: "3px solid #0C0C0C",
                    boxShadow: "5px 5px 0 #0C0C0C",
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Cloud size={20} style={{ color: "var(--accent)" }} />
                    <span className="font-medium">Supabase Database</span>
                    <span
                      className="ml-auto text-[10px] uppercase tracking-wider"
                      style={{
                        color:
                          dbStatus === "connected"
                            ? "#0D9970"
                            : dbStatus === "error"
                              ? "#C94A00"
                              : "#D4A800",
                      }}
                    >
                      {dbStatus === "connected"
                        ? "● Connected"
                        : dbStatus === "error"
                          ? "● Error"
                          : dbStatus === "connecting"
                            ? "● Connecting…"
                            : "○ Idle"}
                    </span>
                  </div>
                  <p className="mb-4 text-xs opacity-60">
                    Cloud backup of labels, types, saved items, to-dos and journal.
                    Desk state is pulled automatically on login. Run the SQL once
                    in the Supabase SQL editor if the table is missing.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      className="nb-btn w-full"
                      onClick={async () => {
                        setDbStatus("connecting");
                        await supabasePush();
                        setDbStatus("connected");
                      }}
                    >
                      <Cloud size={14} /> Push to Supabase
                    </button>
                    <button
                      className="nb-btn nb-btn-secondary w-full"
                      onClick={async () => {
                        setDbStatus("connecting");
                        await supabasePull();
                        setDbStatus("connected");
                      }}
                    >
                      <Download size={14} /> Pull from Supabase
                    </button>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs uppercase tracking-wider opacity-50">
                      Setup SQL (once)
                    </summary>
                    <textarea
                      className="nb-input mt-2 h-32 text-[10px]"
                      readOnly
                      value={SETUP_SQL}
                    />
                  </details>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  className="nb-btn nb-btn-secondary"
                  onClick={() =>
                    downloadNamed(
                      `marque-full-${new Date().toISOString().slice(0, 10)}.json`,
                      JSON.stringify(
                        { exportedAt: new Date().toISOString(), messages, ...persisted },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  <Download size={14} /> Full JSON Backup
                </button>
                <button className="nb-btn" onClick={printMyDay}>
                  <Calendar size={14} /> Print My Day
                </button>
              </div>
            </div>
          )}

          {activeTab === "db" && (
            <div className="nb-panel p-5">
              <h2
                className="mb-2 text-2xl"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "1px" }}
              >
                DATABASE STORE
              </h2>
              <p className="mb-4 text-sm opacity-60">
                View and delete rows stored in Supabase table <code>marque_desk</code>.
                Default row id is <code>default</code>.
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                <button className="nb-btn" onClick={() => void loadDbEntries()}>
                  <RefreshCw size={14} /> Refresh entries
                </button>
                <button className="nb-btn nb-btn-secondary" onClick={supabasePull}>
                  <Download size={14} /> Pull default into app
                </button>
              </div>
              {dbEntries.length === 0 && (
                <p className="text-sm opacity-50">
                  No rows loaded yet. Click Refresh (requires table + RLS).
                </p>
              )}
              <div className="space-y-3">
                {dbEntries.map((row) => {
                  const p = (row.payload ?? {}) as {
                    savedAt?: string;
                    messageCount?: number;
                    persisted?: {
                      todos?: { id: string; text: string; done?: boolean }[];
                      labels?: { name: string }[];
                      types?: { name: string }[];
                      journal?: { kind: string; text: string }[];
                      savedIds?: string[];
                      workspaceName?: string;
                    };
                  };
                  const desk = p.persisted ?? {};
                  const todos = desk.todos ?? [];
                  const openTodos = todos.filter((t) => !t.done);
                  const labels = desk.labels ?? [];
                  const types = desk.types ?? [];
                  const journal = desk.journal ?? [];
                  const savedCount = desk.savedIds?.length ?? 0;

                  return (
                    <div
                      key={row.id}
                      className="border-2 border-black p-4"
                      style={{ boxShadow: "4px 4px 0 #0C0C0C" }}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-base">
                            {desk.workspaceName ?? "Workspace"} ·{" "}
                            <span
                              className="text-xs opacity-50"
                              style={{ fontFamily: "var(--font-mono)" }}
                            >
                              id: {row.id}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-50 mt-0.5">
                            Updated{" "}
                            {row.updated_at
                              ? new Date(row.updated_at).toLocaleString()
                              : p.savedAt
                                ? new Date(p.savedAt).toLocaleString()
                                : "—"}
                          </div>
                        </div>
                        <button
                          className="nb-btn nb-btn-secondary text-xs"
                          onClick={() => void deleteDbEntry(row.id)}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{todos.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            To-dos ({openTodos.length} open)
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{labels.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            Labels
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">{types.length}</div>
                          <div className="text-[10px] uppercase opacity-50">
                            Types
                          </div>
                        </div>
                        <div className="border border-black/15 p-2 text-center">
                          <div className="text-lg font-bold">
                            {p.messageCount ?? "—"}
                          </div>
                          <div className="text-[10px] uppercase opacity-50">
                            Messages · {savedCount} saved
                          </div>
                        </div>
                      </div>

                      {labels.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Labels
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {labels.map((l, i) => (
                              <span key={i} className="nb-badge text-[11px]">
                                {l.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {types.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Types
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {types.map((t, i) => (
                              <span key={i} className="nb-badge text-[11px]">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {openTodos.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Open to-dos
                          </div>
                          <ul className="text-sm space-y-1">
                            {openTodos.slice(0, 6).map((t) => (
                              <li key={t.id} className="truncate">
                                ☐ {t.text}
                              </li>
                            ))}
                            {openTodos.length > 6 && (
                              <li className="text-xs opacity-50">
                                +{openTodos.length - 6} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {journal.length > 0 && (
                        <div>
                          <div className="text-[10px] uppercase opacity-50 mb-1">
                            Journal ({journal.length})
                          </div>
                          <ul className="text-sm space-y-1">
                            {journal.slice(0, 4).map((j, i) => (
                              <li key={i} className="truncate">
                                <span className="text-[10px] uppercase opacity-50 mr-1">
                                  {j.kind}
                                </span>
                                {j.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {todos.length === 0 &&
                        labels.length === 0 &&
                        types.length === 0 &&
                        journal.length === 0 && (
                          <p className="text-xs opacity-50">
                            Empty desk state (no todos, labels, types, or journal).
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Confirm modal */}
        {confirmAction && (
          <div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            style={{ background: "rgba(12,12,12,0.45)" }}
            onClick={() => setConfirmAction(null)}
          >
            <div
              className="nb-panel max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                className="mb-2 text-xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {confirmAction.title}
              </h3>
              <p className="mb-5 text-sm opacity-70">{confirmAction.body}</p>
              <div className="flex gap-2 justify-end">
                <button
                  className="nb-btn nb-btn-secondary"
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
                <button
                  className="nb-btn"
                  onClick={() => {
                    const fn = confirmAction.onConfirm;
                    setConfirmAction(null);
                    fn();
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
=======
        {error && (
          <p style={{ color: "#C94A00", fontSize: 14 }}>{error}</p>
>>>>>>> deadb42a47f59a5e41d1e28dd8a752fd533a0676
        )}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            background: "#C94A00",
            color: "#fff",
            border: "2px solid #0C0C0C",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
