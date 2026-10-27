
document.addEventListener("DOMContentLoaded", function () {

    // Mobile navigation menu
    const menuToggle = document.getElementById("menuToggle");
    const navMenu = document.getElementById("navMenu");

    menuToggle.addEventListener("click", function () {
        const isOpen = navMenu.classList.toggle("open");

        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.textContent = isOpen ? "✕" : "☰";
    });

    // Close mobile menu after selecting a link
    navMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            navMenu.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.textContent = "☰";
        });
    });

    // Set the current year automatically
    document.getElementById("currentYear").textContent =
        new Date().getFullYear();

    // Product enquiry buttons preselect the product
    document.querySelectorAll(".enquiry-product").forEach(function (button) {
        button.addEventListener("click", function () {
            const selectedProduct = button.dataset.product;
            const productChoice = document.getElementById("productChoice");

            productChoice.value = selectedProduct;

            document.getElementById("enquiry").scrollIntoView({
                behavior: "smooth"
            });

            productChoice.focus();
        });
    });

    // Product enquiry form validation
    const enquiryForm = document.getElementById("enquiryForm");
    const formMessage = document.getElementById("formMessage");

    enquiryForm.addEventListener("submit", function (event) {
        event.preventDefault();

        formMessage.textContent = "";
        formMessage.style.color = "";

        if (!enquiryForm.checkValidity()) {
            enquiryForm.reportValidity();
            return;
        }

        const customerName =
            document.getElementById("customerName").value.trim();

        const customerEmail =
            document.getElementById("customerEmail").value.trim();

        const customerPhone =
            document.getElementById("customerPhone").value.trim();

        const customerMessage =
            document.getElementById("customerMessage").value.trim();

        if (
            customerName.length < 2 ||
            customerEmail === "" ||
            !/^[6-9][0-9]{9}$/.test(customerPhone) ||
            customerMessage === ""
        ) {
            formMessage.textContent =
                "Please check your details and try again.";
            formMessage.style.color = "#b91c1c";
            return;
        }

        formMessage.textContent =
            "Thank you, " + customerName +
            "! Your enquiry passed validation successfully.";

        formMessage.style.color = "#15803d";

        // Demo only: no server or email submission takes place.
        enquiryForm.reset();
    });

    console.log("NovaMart website loaded successfully!");
});
