"use strict";

const STORAGE_KEY = "student-progress-tracker.v1";
const elements = {
  notice: document.querySelector("#notice"),
  today: document.querySelector("#today"),
  studentCount: document.querySelector("#student-count"),
  classAverage: document.querySelector("#class-average"),
  resultCount: document.querySelector("#result-count"),
  studentListCount: document.querySelector("#student-list-count"),
  studentList: document.querySelector("#student-list"),
  selectedStudentLabel: document.querySelector("#selected-student-label"),
  chartWrap: document.querySelector("#chart-wrap"),
  chartCaption: document.querySelector("#chart-caption"),
  studentForm: document.querySelector("#student-form"),
  examForm: document.querySelector("#exam-form"),
  examStudent: document.querySelector("#exam-student")
};

let students = loadStudents();
let selectedStudentId = students.length ? students[0].id : null;

elements.today.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
}).format(new Date());
elements.examForm.elements.date.value = dateInputValue();
render();

elements.studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const group = form.elements.group.value.trim();
  if (!name) {
    showNotice("Enter a student name before adding a student.");
    return;
  }

  const student = { id: createId(), name, group, results: [] };
  students.push(student);
  selectedStudentId = student.id;
  persistAndRender("Student added.");
  form.reset();
  elements.examForm.elements.student.value = student.id;
});

elements.examForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const student = students.find((item) => item.id === form.elements.student.value);
  const score = Number(form.elements.score.value);
  const maxScore = Number(form.elements.maxScore.value);
  const date = form.elements.date.value;
  const exam = form.elements.exam.value.trim();
  const subject = form.elements.subject.value.trim();

  if (!student) {
    showNotice("Add a student before recording an exam result.");
    return;
  }
  if (!exam || !subject || !date || !Number.isFinite(score) || !Number.isFinite(maxScore) ||
      maxScore <= 0 || score < 0 || score > maxScore) {
    showNotice("Enter an exam, subject, date, and a score between zero and the maximum score.");
    return;
  }

  student.results.push({
    id: createId(),
    exam,
    subject,
    date,
    score,
    maxScore
  });
  selectedStudentId = student.id;
  persistAndRender("Exam result saved.");
  form.reset();
  form.elements.student.value = student.id;
  form.elements.maxScore.value = "100";
  form.elements.date.value = dateInputValue();
});

function loadStudents() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    const valid = Array.isArray(parsed) && parsed.every((student) =>
      student && typeof student.id === "string" &&
      typeof student.name === "string" && typeof student.group === "string" &&
      Array.isArray(student.results) && student.results.every((result) =>
        result && typeof result.id === "string" &&
        typeof result.exam === "string" && typeof result.subject === "string" &&
        isValidDate(result.date) && Number.isFinite(result.score) &&
        Number.isFinite(result.maxScore) && result.maxScore > 0 &&
        result.score >= 0 && result.score <= result.maxScore
      )
    );
    if (!valid) throw new Error("Saved data has an invalid student or exam result.");
    return parsed;
  } catch (error) {
    console.error("Could not load student progress data:", error);
    showNotice("Saved data could not be read. You can still add results, but check browser storage before continuing.");
    return [];
  }
}

function persistAndRender(message) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    showNotice(message);
  } catch (error) {
    console.error("Could not save student progress data:", error);
    showNotice("The update is visible now, but could not be saved in this browser. Check available storage and browser permissions.");
  }
  render();
}

function render() {
  const allResults = students.flatMap((student) => student.results);
  const percentages = allResults.map((result) => (result.score / result.maxScore) * 100);
  const classAverage = percentages.length
    ? percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length
    : null;

  elements.studentCount.textContent = String(students.length);
  elements.classAverage.textContent = classAverage === null ? "—" : `${formatNumber(classAverage)}%`;
  elements.resultCount.textContent = String(allResults.length);
  elements.studentListCount.textContent = String(students.length);
  renderStudentOptions();
  renderStudentList();
  renderChart();
}

function renderStudentOptions() {
  elements.examStudent.replaceChildren();
  if (students.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Add a student first";
    elements.examStudent.append(option);
    elements.examStudent.disabled = true;
    elements.examForm.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  elements.examStudent.disabled = false;
  elements.examForm.querySelector('button[type="submit"]').disabled = false;
  for (const student of students) {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    elements.examStudent.append(option);
  }
  if (!students.some((student) => student.id === selectedStudentId)) {
    selectedStudentId = students[0].id;
  }
  elements.examStudent.value = selectedStudentId;
}

function renderStudentList() {
  elements.studentList.replaceChildren();
  if (students.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "No students yet. Add a student to start tracking progress.";
    elements.studentList.append(empty);
    return;
  }

  for (const student of students) {
    const percentages = student.results.map((result) => result.score / result.maxScore * 100);
    const average = percentages.length
      ? percentages.reduce((total, percentage) => total + percentage, 0) / percentages.length
      : null;
    const button = document.createElement("button");
    button.className = "student-option";
    button.type = "button";
    button.setAttribute("aria-pressed", String(student.id === selectedStudentId));
    button.addEventListener("click", () => {
      selectedStudentId = student.id;
      elements.examStudent.value = student.id;
      render();
    });

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initials(student.name);

    const meta = document.createElement("span");
    meta.className = "student-meta";
    const name = document.createElement("span");
    name.className = "student-name";
    name.textContent = student.name;
    const group = document.createElement("span");
    group.className = "student-group";
    group.textContent = student.group || `${student.results.length} exam${student.results.length === 1 ? "" : "s"}`;
    meta.append(name, group);

    const result = document.createElement("span");
    result.className = "student-average";
    result.textContent = average === null ? "—" : `${formatNumber(average)}%`;
    const resultLabel = document.createElement("small");
    resultLabel.textContent = average === null ? "no results" : "average";
    result.append(resultLabel);
    button.append(avatar, meta, result);
    elements.studentList.append(button);
  }
}

function renderChart() {
  elements.chartWrap.replaceChildren();
  elements.chartCaption.replaceChildren();
  const student = students.find((item) => item.id === selectedStudentId);
  if (!student) {
    elements.selectedStudentLabel.textContent = "Select a student to view their results.";
    const empty = document.createElement("p");
    empty.className = "empty-chart";
    empty.textContent = "Add a student and exam results to see progress here.";
    elements.chartWrap.append(empty);
    return;
  }

  elements.selectedStudentLabel.textContent = student.group
    ? `${student.name} · ${student.group}`
    : student.name;
  const results = [...student.results].sort((a, b) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );
  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-chart";
    empty.textContent = "Add an exam result for this student to see their progress.";
    elements.chartWrap.append(empty);
    return;
  }

  elements.chartWrap.append(createChart(results));
  const latest = results[results.length - 1];
  const latestLabel = document.createElement("span");
  latestLabel.textContent = `Latest: ${latest.exam} · ${latest.subject}`;
  const latestDate = document.createElement("span");
  latestDate.textContent = formatDate(latest.date);
  elements.chartCaption.append(latestLabel, latestDate);
}

function createChart(results) {
  const width = 720;
  const height = 220;
  const left = 38;
  const right = 12;
  const top = 14;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const scores = results.map((result) => result.score / result.maxScore * 100);
  const points = scores.map((score, index) => ({
    x: results.length === 1 ? left + plotWidth / 2 : left + index * plotWidth / (results.length - 1),
    y: top + (100 - score) * plotHeight / 100,
    score
  }));
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "chart-svg",
    role: "img",
    "aria-label": `Exam score trend for ${results.length} results`
  });
  const defs = svgElement("defs");
  const gradient = svgElement("linearGradient", { id: "chart-fill", x1: "0", x2: "0", y1: "0", y2: "1" });
  gradient.append(
    svgElement("stop", { offset: "0%", "stop-color": "#756cf0", "stop-opacity": ".18" }),
    svgElement("stop", { offset: "100%", "stop-color": "#756cf0", "stop-opacity": "0" })
  );
  defs.append(gradient);
  svg.append(defs);

  for (const value of [0, 25, 50, 75, 100]) {
    const y = top + (100 - value) * plotHeight / 100;
    svg.append(
      svgElement("line", { x1: left, y1: y, x2: width - right, y2: y, class: "chart-gridline" }),
      svgElement("text", { x: 0, y: y + 3, class: "chart-axis-label" }, `${value}%`)
    );
  }

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${left},${top + plotHeight} ${linePoints} ${points[points.length - 1].x},${top + plotHeight}`;
  svg.append(svgElement("polygon", { points: areaPoints, class: "chart-area" }));
  svg.append(svgElement("polyline", { points: linePoints, class: "chart-line" }));

  points.forEach((point, index) => {
    const result = results[index];
    const circle = svgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 4,
      class: "chart-point"
    });
    circle.append(svgElement("title", {}, `${result.exam}, ${result.subject}: ${formatNumber(point.score)}% on ${formatDate(result.date)}`));
    svg.append(circle);
    if (results.length <= 6 || index === 0 || index === results.length - 1) {
      const label = svgElement("text", {
        x: point.x,
        y: height - 8,
        class: "chart-axis-label",
        "text-anchor": results.length === 1 ? "middle" : index === 0 ? "start" : index === results.length - 1 ? "end" : "middle"
      }, shortDate(result.date));
      svg.append(label);
    }
  });
  return svg;
}

function svgElement(name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = false;
}

function createId() {
  return globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

function formatNumber(number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function shortDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}
