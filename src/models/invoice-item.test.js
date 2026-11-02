const Invoice = require("./invoice");
const InvoiceItem = require("./invoice-item");
const Product = require("./product");
const ItemState = require("./item-state");

describe("InvoiceItem model", () => {
  it("maps the invoice_items table", () => {
    expect(InvoiceItem.name).toBe("InvoiceItem");
    expect(InvoiceItem.tableName).toBe("invoice_items");
  });

  it("defines the snapshot columns", () => {
    const attributes = InvoiceItem.getAttributes();

    expect(attributes.invoice_id.allowNull).toBe(false);
    expect(attributes.order_item_id.allowNull).toBe(true);
    expect(attributes.product_id.allowNull).toBe(false);
    expect(attributes.item_state_id.allowNull).toBe(false);
    expect(attributes.product_name.type.toString()).toBe("VARCHAR(150)");
    expect(attributes.product_reference.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.item_state_name.type.toString()).toBe("VARCHAR(50)");
    expect(attributes.quantity.allowNull).toBe(false);
    expect(attributes.unit_price.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.subtotal.type.toString()).toBe("DECIMAL(12,2)");
  });

  it("belongs to the invoice, product and item state", () => {
    expect(InvoiceItem.associations.invoice.target).toBe(Invoice);
    expect(InvoiceItem.associations.invoice.foreignKey).toBe("invoice_id");
    expect(InvoiceItem.associations.product.target).toBe(Product);
    expect(InvoiceItem.associations.item_state.target).toBe(ItemState);
  });

  it("registers the invoice items and inverse catalog associations", () => {
    expect(Invoice.associations.items.target).toBe(InvoiceItem);
    expect(Invoice.associations.items.foreignKey).toBe("invoice_id");
    expect(Product.associations.invoice_items.target).toBe(InvoiceItem);
    expect(ItemState.associations.invoice_items.target).toBe(InvoiceItem);
  });
});
