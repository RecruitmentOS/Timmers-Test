import { describe, it, expect } from "vitest";
import { renderTemplate } from "../../src/modules/intake/templates/renderer.js";

describe("renderTemplate", () => {
  it("substitutes simple merge fields", () => {
    const out = renderTemplate(
      "Hoi {{candidate.first_name}}, functie: {{vacancy.title}}",
      {
        candidate: { first_name: "Jan", full_name: "Jan de Vries" },
        vacancy: { title: "CE Chauffeur", location: "Utrecht", start_date: null },
        client: { name: "Timmers" },
        tenant: { name: "Demo Agency" },
        recruiter: { name: "Anna", phone: "+31600000002" },
      },
    );
    expect(out).toBe("Hoi Jan, functie: CE Chauffeur");
  });

  it("renders missing fields as empty string", () => {
    const out = renderTemplate("Hi {{candidate.first_name}}{{unknown.field}}", {
      candidate: { first_name: "Sam", full_name: "Sam X" },
      vacancy: { title: "T", location: null, start_date: null },
      client: { name: "C" }, tenant: { name: "N" },
      recruiter: { name: "R", phone: "R" },
    } as any);
    expect(out).toBe("Hi Sam");
  });

  it("is safe against injection (no recursive substitution)", () => {
    const out = renderTemplate("A {{candidate.first_name}} B", {
      candidate: { first_name: "{{vacancy.title}}", full_name: "x" },
      vacancy: { title: "BAD", location: null, start_date: null },
      client: { name: "c" }, tenant: { name: "t" },
      recruiter: { name: "r", phone: "r" },
    } as any);
    expect(out).toBe("A {{vacancy.title}} B");
  });
});
