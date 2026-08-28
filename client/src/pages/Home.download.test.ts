import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./Home";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("triggers a standard browser download with the requested filename", () => {
    const anchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click: vi.fn(),
      remove: vi.fn(),
    };
    const createObjectURL = vi.fn(() => "blob:iconmorph-test");
    const revokeObjectURL = vi.fn();
    const appendChild = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { setTimeout: (callback: () => void) => callback() });

    downloadBlob(new Blob(["zip-content"], { type: "application/zip" }), "iconmorph-batch.zip");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.href).toBe("blob:iconmorph-test");
    expect(anchor.download).toBe("iconmorph-batch.zip");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:iconmorph-test");
  });
});
