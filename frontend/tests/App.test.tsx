import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../src/App";

describe("App", () => {
  it("renders the application header", () => {
    render(<App />);
    const elements = screen.getAllByText("ClawStack");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the home page by default", () => {
    render(<App />);
    expect(
      screen.getByText(/production-ready fullstack template/i),
    ).toBeDefined();
  });

  it("renders navigation links", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "Home" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Items" })).toBeDefined();
  });
});
