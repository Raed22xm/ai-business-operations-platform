import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, ClipboardList, Ellipsis, FileText, Plus, Users } from "lucide-react";
import { AssistantPanel } from "@/app/assistant-panel";
import { DashboardLoading } from "@/app/dashboard-loading";
import { CasePicker } from "@/app/dashboard-tools";
import { caseStatusLabel, getCases, type CustomerCase } from "@/lib/cases";
import { getCustomers, type Customer } from "@/lib/customers";
import { getDashboardSummary, type DashboardSummary, type OutstandingTask } from "@/lib/dashboard";
import { getTasksForCase, type CaseTask } from "@/lib/tasks";
import { formatTaskDueDate, isTaskOverdue, taskPriorityLabel, taskStatusLabel } from "@/lib/tasks-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };
type Query = { q?: string; customerId?: string; caseId?: string };

export default function Home({ searchParams }: { searchParams: Promise<Query> }) {
  return <Suspense fallback={<DashboardLoading />}><Dashboard searchParams={searchParams} /></Suspense>;
}

async function Dashboard({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const [summary, customers, cases] = await Promise.all([getDashboardSummary(), getCustomers({ search: query.q }), getCases()]);
  const selectedCustomer = customers.find((customer) => customer.id === Number(query.customerId)) ?? customers.find((customer) => cases.some((work) => work.customerId === customer.id)) ?? customers[0];
  const customerCases = selectedCustomer ? cases.filter((work) => work.customerId === selectedCustomer.id) : [];
  const selectedCase = customerCases.find((work) => work.id === Number(query.caseId)) ?? customerCases[0];
  let tasks: CaseTask[] = [];
  let tasksUnavailable = false;
  if (selectedCase) {
    try { tasks = await getTasksForCase(selectedCase.id); }
    catch { tasksUnavailable = true; }
  }
  return <main className="operations-dashboard" aria-label="Operations dashboard">
    <h1 className="sr-only">Dashboard</h1>
    <CustomerPanel customers={customers} cases={cases} selectedCustomer={selectedCustomer} query={query} total={summary.totalCustomers} />
    <CasePanel customer={selectedCustomer} work={selectedCase} cases={customerCases} tasks={tasks} tasksUnavailable={tasksUnavailable} query={query} businessTodayIso={summary.businessToday} />
    <div className="dashboard-right-column">
      <AssistantPanel
        key={selectedCase?.id ?? "no-case"}
        customer={selectedCustomer}
        work={selectedCase}
      />
      <MetricsPanel summary={summary} />
    </div>
  </main>;
}

function CustomerPanel({ customers, cases, selectedCustomer, query, total }: { customers: Customer[]; cases: CustomerCase[]; selectedCustomer?: Customer; query: Query; total: number }) {
  return <section className="work-panel customer-panel" aria-labelledby="customer-list-heading">
    <div className="panel-heading"><div><h2 id="customer-list-heading">Customer list</h2><p>{query.q ? `Results for “${query.q}”` : "Current clients"}</p></div><Link href="/customers" className="icon-button" aria-label="Manage customers"><Ellipsis size={20} /></Link></div>
    <div className="customer-list-scroll">
      <table className="workspace-customer-table"><thead><tr><th scope="col">Name <ArrowDown size={11} /><span className="customer-company-label"> / Company</span></th><th scope="col">Contact</th><th scope="col">Cases</th></tr></thead><tbody>
        {customers.map((customer) => {
          const work = cases.filter((item) => item.customerId === customer.id);
          const active = work.some((item) => item.status !== "Closed");
          const selected = customer.id === selectedCustomer?.id;
          const params = new URLSearchParams({ customerId: String(customer.id) });
          if (query.q) params.set("q", query.q);
          return <tr key={customer.id} className={selected ? "is-selected" : ""}><td><Link className="customer-select" href={`/?${params}`} aria-current={selected ? "true" : undefined} aria-label={`Select ${customer.name}`}><Avatar customer={customer} /><span className="customer-identity"><strong>{customer.name}</strong><span>{customer.company || "Individual customer"}</span></span></Link></td><td><a className="customer-email" href={`mailto:${customer.email}`} title={customer.email}>{customer.email}</a></td><td><span className={`customer-work-status${active ? " is-open" : ""}`}><span />{active ? "Active" : work.length ? "Closed" : "No cases"}</span></td></tr>;
        })}
      </tbody></table>
      {customers.length === 0 ? <div className="panel-empty"><Users size={30} /><h3>{query.q ? "No matching customers" : "Your workspace starts here"}</h3><p>{query.q ? "Try another name, company, or email." : "Add your first customer to bring their work into focus."}</p><Link href={query.q ? "/" : "/customers"} className="workspace-button">{query.q ? "Clear search" : "Add a customer"}<ArrowRight size={15} /></Link></div> : <div className="customer-list-note"><span className="connection-dot" />Select a customer to explore their work.</div>}
    </div>
    <div className="panel-footer"><span>{query.q ? `${customers.length} of ${total}` : total} {total === 1 ? "customer" : "customers"}</span><Link href="/customers">Manage customers<ArrowUpRight size={14} /></Link></div>
  </section>;
}

function CasePanel({ customer, work, cases, tasks, tasksUnavailable, query, businessTodayIso }: { customer?: Customer; work?: CustomerCase; cases: CustomerCase[]; tasks: CaseTask[]; tasksUnavailable: boolean; query: Query; businessTodayIso: string }) {
  return <section className="work-panel case-panel" aria-labelledby="case-panel-heading">
    <div className="panel-heading"><h2 id="case-panel-heading">Case details</h2>{work && <Link href={`/cases/${work.id}`} className="icon-button" aria-label="Open case details"><Ellipsis size={20} /></Link>}</div>
    {!work ? <div className="panel-empty case-empty"><ClipboardList size={33} /><h3>{customer ? "A fresh start" : "Your next case, in focus"}</h3><p>{customer ? `${customer.name} has no cases yet. Create one to start organising their work.` : "Select a customer to see their case and tasks here."}</p><Link className="workspace-button is-primary" href={customer ? `/cases?customerId=${customer.id}` : "/customers"}><Plus size={15} />{customer ? "Create a case" : "Add a customer"}</Link></div> : <>
      <div className="case-content">
        <div className="case-reference"><span>#{String(work.id).padStart(4, "0")}</span>{cases.length > 1 && <CasePicker cases={cases} selectedId={work.id} customerId={work.customerId} search={query.q} />}</div>
        <h3 className="case-title"><Link href={`/cases/${work.id}`}>{work.title}</Link></h3>
        <span className={`case-badge status-${work.status.toLowerCase()}`}><span />{caseStatusLabel(work.status)}</span>
        <div className="case-information">
          <div><p className="detail-label">Customer</p>{customer && <Link href={`/customers/${customer.id}`} className="case-customer"><Avatar customer={customer} small /><span><strong>{customer.name}</strong><span>{customer.company || "Individual customer"}</span></span></Link>}</div>
          <div className="case-date"><p className="detail-label">Created</p><p><CalendarDays size={17} /><time dateTime={work.createdAt}>{dateLabel(work.createdAt)}</time><span className="timezone">UTC</span></p></div>
        </div>
        <div className="case-timeline" aria-label="Case creation and current tasks">
          <div className="timeline-entry is-complete"><span className="timeline-node"><Check size={10} /></span><div><strong>Case created</strong><time dateTime={work.createdAt}>{dateLabel(work.createdAt, true)} UTC</time></div></div>
          {tasksUnavailable ? <div className="timeline-entry"><span className="timeline-node" /><div><strong>Tasks couldn’t be loaded</strong><Link href={`/cases/${work.id}`}>Open case to try again <ChevronRight size={12} /></Link></div></div> : tasks.length ? tasks.slice(0, 3).map((task) => {
            const overdue = isTaskOverdue(task.dueDate, task.status, businessTodayIso);
            return <div key={task.id} className={`timeline-entry${task.status === "Done" ? " is-complete" : task.status === "InProgress" ? " is-current" : ""}${overdue ? " is-overdue" : ""}`}><span className="timeline-node">{task.status === "Done" && <Check size={10} />}</span><div><strong>{task.title}</strong><span>{taskStatusLabel(task.status)} · <span className="task-priority-inline" data-priority={task.priority}>{taskPriorityLabel(task.priority)}</span>{task.dueDate ? ` · Due ${formatTaskDueDate(task.dueDate)}` : ""}{overdue ? <span className="task-overdue-inline"> · Overdue</span> : null}</span></div></div>;
          }) : <div className="timeline-entry"><span className="timeline-node" /><div><strong>Ready for the next step</strong><span>No tasks added yet</span><Link href={`/cases/${work.id}`}>Add a task <Plus size={12} /></Link></div></div>}
        </div>
        <div className="case-note"><div className="case-note-label"><FileText size={14} />Case description</div><p>{work.description || "Add a description to give this case more context."}</p><Link href={`/cases/${work.id}`} className="workspace-button small-button">Open & edit<ArrowUpRight size={13} /></Link></div>
      </div>
      <div className="panel-footer"><span>{tasksUnavailable ? "Tasks unavailable" : `${tasks.filter((task) => task.status === "Done").length} of ${tasks.length} tasks complete`}</span><Link href={`/cases/${work.id}`}>View case<ArrowRight size={14} /></Link></div>
    </>}
  </section>;
}

function MetricsPanel({ summary }: { summary: DashboardSummary }) {
  const metrics = [
    { label: "Overdue tasks", value: summary.overdueTasks, href: "/tasks?due=overdue", caption: "Due before today", emphasize: summary.overdueTasks > 0 },
    { label: "Due today", value: summary.dueTodayTasks, href: "/tasks?due=today", caption: "Not done yet", emphasize: false },
    { label: "Active cases", value: summary.openCases + summary.inProgressCases, href: "/cases", caption: "Open + in progress", emphasize: false },
    { label: "Customers", value: summary.totalCustomers, href: "/customers", caption: "In your workspace", emphasize: false },
  ];
  return (
    <section id="business-kpis" className="work-panel metrics-panel" aria-labelledby="business-kpis-heading">
      <div className="panel-heading">
        <h2 id="business-kpis-heading">Business KPIs</h2>
        <span className="live-data"><span className="connection-dot" />Live · {summary.businessTimeZone}</span>
      </div>
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <Link
            className={`metric-tile${metric.emphasize ? " is-alert" : ""}`}
            key={metric.label}
            href={metric.href}
          >
            <span>{metric.label}<ArrowUpRight size={12} /></span>
            <strong>{metric.value}</strong>
            <small>{metric.caption}</small>
          </Link>
        ))}
      </div>
      <OutstandingTasksList tasks={summary.outstandingTasks} />
      <div className="metrics-footer">
        <span>{summary.totalCases} total cases</span>
        <Link href="/cases?status=Open">{summary.openCases} open<ChevronRight size={12} /></Link>
      </div>
    </section>
  );
}

function OutstandingTasksList({ tasks }: { tasks: OutstandingTask[] }) {
  return (
    <div className="outstanding-tasks" aria-labelledby="outstanding-tasks-heading">
      <div className="outstanding-tasks-heading">
        <h3 id="outstanding-tasks-heading">Outstanding tasks</h3>
        <span>Earliest due first</span>
      </div>
      {tasks.length === 0 ? (
        <p className="outstanding-empty">No open tasks with work left to do.</p>
      ) : (
        <ul className="outstanding-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link href={`/cases/${task.caseId}`} className="outstanding-item">
                <span className="outstanding-item-main">
                  <strong>{task.title}</strong>
                  <span className="outstanding-case">{task.caseTitle}</span>
                </span>
                <span className="outstanding-due">
                  {task.dueDate ? (
                    <time dateTime={task.dueDate}>{formatTaskDueDate(task.dueDate)}</time>
                  ) : (
                    <span>No due date</span>
                  )}
                  <span className="task-priority-label" data-priority={task.priority}>
                    {taskPriorityLabel(task.priority)}
                  </span>
                  {task.isOverdue ? (
                    <span className="task-overdue-label">Overdue</span>
                  ) : task.isDueToday ? (
                    <span className="task-due-today-label">Due today</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Avatar({ customer, small = false }: { customer: Customer; small?: boolean }) {
  const initials = customer.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return <span aria-hidden="true" className={`customer-avatar avatar-${customer.id % 4}${small ? " is-small" : ""}`}>{initials}</span>;
}

function dateLabel(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}
