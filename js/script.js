// Slideshow de Produtos
let slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function currentSlide(n) {
  showSlides(slideIndex = n);
}

function showSlides(n) {
  let i;
  let slides = document.getElementsByClassName("slide-produto");
  let dots = document.getElementsByClassName("dot");

  if (n > slides.length) { slideIndex = 1 }
  if (n < 1) { slideIndex = slides.length }

  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }

  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }

  slides[slideIndex - 1].style.display = "block";
  dots[slideIndex - 1].className += " active";
}

// Slideshow de Açaí
let açaiSlideIndex = 1;
showAçaiSlides(açaiSlideIndex);

function plusAçaiSlides(n) {
  showAçaiSlides(açaiSlideIndex += n);
}

function currentAçaiSlide(n) {
  showAçaiSlides(açaiSlideIndex = n);
}

function showAçaiSlides(n) {
  let i;
  let slides = document.getElementsByClassName("slide-açai");
  let dots = document.getElementsByClassName("dot-açai");

  if (n > slides.length) { açaiSlideIndex = 1 }
  if (n < 1) { açaiSlideIndex = slides.length }

  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }

  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }

  slides[açaiSlideIndex - 1].style.display = "block";
  dots[açaiSlideIndex - 1].className += " active";
}

// Troca automática de slides
setInterval(function () {
  plusSlides(1);
  plusAçaiSlides(1);
}, 8000);


var hora = new Date().getHours();
var saudacao;

if (hora < 12) {
  saudacao = "Bom dia! Que bom ver você aqui!";
} else if (hora < 18) {
  saudacao = "Boa tarde! Espero que esteja tendo um ótimo dia!";
} else {
  saudacao = "Boa noite! Espero que tenha tido um dia maravilhoso!";
}
document.getElementById("mensagem").innerHTML = saudacao;